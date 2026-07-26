import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reset(): Promise<void> {
  await prisma.recipeIngredient.deleteMany();
  await prisma.cookLog.deleteMany();
  await prisma.cartSnapshot.deleteMany();
  await prisma.mealPlanSlot.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.ingredient.deleteMany();
}

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

describe('RecipeIngredient.unit database constraint', () => {
  beforeEach(async () => {
    await reset();
  });

  async function seedRecipe(): Promise<{ recipeId: string; ingredientId: string }> {
    const ingredient = await prisma.ingredient.create({
      data: { name: 'Salt', category: 'Spices', defaultUnit: 'g' },
    });
    const recipe = await prisma.recipe.create({ data: { title: 'Test' } });
    return { recipeId: recipe.id, ingredientId: ingredient.id };
  }

  it.each(['g', 'ml', 'pcs'])('accepts unit %s', async (unit) => {
    const { recipeId, ingredientId } = await seedRecipe();
    const row = await prisma.recipeIngredient.create({
      data: { recipeId, ingredientId, quantity: 1, unit },
    });
    expect(row.unit).toBe(unit);
  });

  it('rejects an unsupported unit value', async () => {
    const { recipeId, ingredientId } = await seedRecipe();
    await expect(
      prisma.recipeIngredient.create({
        data: { recipeId, ingredientId, quantity: 1, unit: 'kg' },
      }),
    ).rejects.toThrow();
  });
});
