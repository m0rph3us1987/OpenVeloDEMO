import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { seed, shouldAutoSeed, SEED_INGREDIENTS, SEED_RECIPES } from '../src/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DATABASE_URL) {
  const tempPath = path.join(
    os.tmpdir(),
    `openvelo-api-seed-${process.pid}-${Date.now()}-${randomBytes(4).toString('hex')}.db`,
  );
  const databaseUrl = `file:${tempPath}`;
  process.env.DATABASE_URL = databaseUrl;
  const prismaBin = path.resolve(__dirname, '..', '..', '..', 'node_modules', '.bin', 'prisma');
  const schemaPath = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
  const constraintsPath = path.resolve(__dirname, '..', 'prisma', 'constraints.sql');
  execFileSync(
    prismaBin,
    ['db', 'push', '--skip-generate', '--accept-data-loss', '--schema', schemaPath],
    { stdio: 'pipe', env: { ...process.env, DATABASE_URL: databaseUrl } },
  );
  execFileSync(
    prismaBin,
    ['db', 'execute', '--schema', schemaPath, '--file', constraintsPath],
    { stdio: 'pipe', env: { ...process.env, DATABASE_URL: databaseUrl } },
  );
}

const prisma = new PrismaClient();

async function reset(): Promise<void> {
  await prisma.recipeIngredient.deleteMany();
  await prisma.cookLog.deleteMany();
  await prisma.mealPlanSlot.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cartSnapshot.deleteMany();
  await prisma.cartHistory.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.ingredient.deleteMany();
}

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

describe('seed()', () => {
  beforeEach(async () => {
    await reset();
  });

  it('inserts every SEED_INGREDIENTS row into an empty database', async () => {
    const result = await seed(prisma);
    expect(result.ingredientsCreated).toBe(SEED_INGREDIENTS.length);
    expect(result.recipesCreated).toBe(SEED_RECIPES.length);

    const ingredients = await prisma.ingredient.findMany();
    expect(ingredients).toHaveLength(SEED_INGREDIENTS.length);

    const names = new Set(ingredients.map((i) => i.name));
    for (const ing of SEED_INGREDIENTS) {
      expect(names.has(ing.name)).toBe(true);
    }

    const recipes = await prisma.recipe.findMany();
    expect(recipes).toHaveLength(SEED_RECIPES.length);

    const lines = await prisma.recipeIngredient.findMany();
    expect(lines.length).toBeGreaterThanOrEqual(SEED_RECIPES.length * 2);
  });

  it('is idempotent: a second call creates no duplicates', async () => {
    const first = await seed(prisma);
    expect(first.ingredientsCreated).toBe(SEED_INGREDIENTS.length);
    expect(first.recipesCreated).toBe(SEED_RECIPES.length);

    const second = await seed(prisma);
    expect(second.ingredientsCreated).toBe(0);
    expect(second.recipesCreated).toBe(0);

    const ingredients = await prisma.ingredient.findMany();
    expect(ingredients).toHaveLength(SEED_INGREDIENTS.length);
    const recipes = await prisma.recipe.findMany();
    expect(recipes).toHaveLength(SEED_RECIPES.length);
  });

  it('auto-seeds recipes when only ingredients exist (boot-time guard)', async () => {
    // Simulate the state left by ensure-db.mjs after the SQL seed has run:
    // seven Ingredient rows pre-populated, Recipe table empty.
    for (const ing of SEED_INGREDIENTS) {
      await prisma.ingredient.create({
        data: { name: ing.name, category: ing.category, defaultUnit: ing.baseUnit },
      });
    }
    const ingCount = await prisma.ingredient.count();
    const recCount = await prisma.recipe.count();
    expect(ingCount).toBe(SEED_INGREDIENTS.length);
    expect(recCount).toBe(0);

    expect(
      shouldAutoSeed({ ingredientCount: ingCount, recipeCount: recCount }),
    ).toBe(true);

    const result = await seed(prisma);
    expect(result.ingredientsCreated).toBe(0);
    expect(result.recipesCreated).toBe(SEED_RECIPES.length);
    expect(await prisma.recipe.count()).toBe(SEED_RECIPES.length);

    // And once recipes are populated, the guard flips to false.
    const ingCountAfter = await prisma.ingredient.count();
    const recCountAfter = await prisma.recipe.count();
    expect(
      shouldAutoSeed({ ingredientCount: ingCountAfter, recipeCount: recCountAfter }),
    ).toBe(false);
  });
});