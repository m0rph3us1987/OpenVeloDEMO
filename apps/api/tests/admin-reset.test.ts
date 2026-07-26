import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { SEED_INGREDIENTS, SEED_RECIPES } from '../src/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DATABASE_URL) {
  const tempPath = path.join(
    os.tmpdir(),
    `openvelo-api-admin-${process.pid}-${Date.now()}-${randomBytes(4).toString('hex')}.db`,
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
const app = createApp(prisma);

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

describe('POST /api/admin/reset', () => {
  beforeEach(async () => {
    await reset();
  });

  it('seeds an empty database with the demo set', async () => {
    const res = await request(app).post('/api/admin/reset').send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      reseeded: true,
      ingredients: SEED_INGREDIENTS.length,
      recipes: SEED_RECIPES.length,
    });

    const ingredients = await prisma.ingredient.findMany();
    expect(ingredients).toHaveLength(SEED_INGREDIENTS.length);
    const recipes = await prisma.recipe.findMany();
    expect(recipes).toHaveLength(SEED_RECIPES.length);
  });

  it('wipes every data table and re-seeds on a populated database', async () => {
    const beef = await prisma.ingredient.create({
      data: { name: 'UserBeef', category: 'Meat', defaultUnit: 'g' },
    });
    const userRecipe = await prisma.recipe.create({
      data: { title: 'User Recipe', description: 'demo', servings: 1 },
    });
    const userSlot = await prisma.mealPlanSlot.create({
      data: {
        week: '2026-W30',
        day: 1,
        date: new Date('2026-07-20T00:00:00Z'),
        slot: 'Dinner',
        recipeId: userRecipe.id,
      },
    });
    const userLog = await prisma.cookLog.create({
      data: { recipeId: userRecipe.id, mealPlanSlotId: userSlot.id },
    });
    const userItem = await prisma.cartItem.create({
      data: {
        week: '2026-W30',
        ingredientId: beef.id,
        unit: 'g',
        quantity: 100,
        source: 'manual',
      },
    });
    const userHistory = await prisma.cartHistory.create({
      data: {
        week: '2026-W29',
        weekStart: '2026-07-13',
        weekEnd: '2026-07-19',
        weekLabel: 'W29 2026-07-13 → 2026-07-19',
        itemsJson: '[]',
      },
    });
    const userSnapshot = await prisma.cartSnapshot.create({
      data: { recipeId: userRecipe.id, itemsJson: '[]' },
    });

    const res = await request(app).post('/api/admin/reset').send({});
    expect(res.status).toBe(200);

    expect(await prisma.ingredient.findUnique({ where: { id: beef.id } })).toBeNull();
    expect(
      await prisma.recipe.findUnique({ where: { id: userRecipe.id } }),
    ).toBeNull();
    expect(
      await prisma.mealPlanSlot.findUnique({ where: { id: userSlot.id } }),
    ).toBeNull();
    expect(await prisma.cookLog.findUnique({ where: { id: userLog.id } })).toBeNull();
    expect(await prisma.cartItem.findUnique({ where: { id: userItem.id } })).toBeNull();
    expect(
      await prisma.cartHistory.findUnique({ where: { id: userHistory.id } }),
    ).toBeNull();
    expect(
      await prisma.cartSnapshot.findUnique({ where: { id: userSnapshot.id } }),
    ).toBeNull();

    expect(await prisma.ingredient.count()).toBe(SEED_INGREDIENTS.length);
    expect(await prisma.recipe.count()).toBe(SEED_RECIPES.length);

    const ingredientsRes = await request(app).get('/api/ingredients');
    expect(ingredientsRes.status).toBe(200);
    expect(ingredientsRes.body).toHaveLength(SEED_INGREDIENTS.length);

    const recipesRes = await request(app).get('/api/recipes');
    expect(recipesRes.status).toBe(200);
    expect(recipesRes.body).toHaveLength(SEED_RECIPES.length);
  });

  it('is repeatable: a second reset leaves the same final state', async () => {
    const first = await request(app).post('/api/admin/reset').send({});
    expect(first.status).toBe(200);
    expect(await prisma.ingredient.count()).toBe(SEED_INGREDIENTS.length);
    expect(await prisma.recipe.count()).toBe(SEED_RECIPES.length);

    const second = await request(app).post('/api/admin/reset').send({});
    expect(second.status).toBe(200);
    expect(second.body).toEqual({
      ok: true,
      reseeded: true,
      ingredients: SEED_INGREDIENTS.length,
      recipes: SEED_RECIPES.length,
    });

    expect(await prisma.ingredient.count()).toBe(SEED_INGREDIENTS.length);
    expect(await prisma.recipe.count()).toBe(SEED_RECIPES.length);
  });
});