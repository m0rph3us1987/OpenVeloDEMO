import type { PrismaClient } from '@prisma/client';
import { type BaseUnit, type IngredientCategory } from '@openvelo/types';

export type SeedIngredient = {
  name: string;
  category: IngredientCategory;
  baseUnit: BaseUnit;
};

export type SeedRecipeLine = {
  ingredientName: string;
  quantity: number;
  unit: BaseUnit;
};

export type SeedRecipe = {
  title: string;
  description: string;
  lines: SeedRecipeLine[];
};

export type SeedResult = {
  ingredientsCreated: number;
  recipesCreated: number;
};

export const SEED_INGREDIENTS: readonly SeedIngredient[] = [
  { name: 'Beef', category: 'Meat', baseUnit: 'g' },
  { name: 'Chicken Breast', category: 'Meat', baseUnit: 'g' },
  { name: 'Tomato', category: 'Vegetables', baseUnit: 'pcs' },
  { name: 'Onion', category: 'Vegetables', baseUnit: 'pcs' },
  { name: 'Garlic', category: 'Vegetables', baseUnit: 'pcs' },
  { name: 'Carrot', category: 'Vegetables', baseUnit: 'pcs' },
  { name: 'Milk', category: 'Dairy', baseUnit: 'ml' },
  { name: 'Butter', category: 'Dairy', baseUnit: 'g' },
  { name: 'Rice', category: 'Grains', baseUnit: 'g' },
  { name: 'Pasta', category: 'Grains', baseUnit: 'g' },
  { name: 'Salt', category: 'Spices', baseUnit: 'g' },
  { name: 'Pepper', category: 'Spices', baseUnit: 'g' },
  { name: 'Olive Oil', category: 'Other', baseUnit: 'ml' },
];

export const SEED_RECIPES: readonly SeedRecipe[] = [
  {
    title: 'Hearty Beef Stew',
    description: 'A warming stew with beef, tomato, and root vegetables.',
    lines: [
      { ingredientName: 'Beef', quantity: 400, unit: 'g' },
      { ingredientName: 'Onion', quantity: 1, unit: 'pcs' },
      { ingredientName: 'Carrot', quantity: 2, unit: 'pcs' },
      { ingredientName: 'Tomato', quantity: 2, unit: 'pcs' },
      { ingredientName: 'Salt', quantity: 5, unit: 'g' },
      { ingredientName: 'Pepper', quantity: 2, unit: 'g' },
    ],
  },
  {
    title: 'Garlic Butter Pasta',
    description: 'Simple pantry pasta tossed in garlic butter with a hint of pepper.',
    lines: [
      { ingredientName: 'Pasta', quantity: 200, unit: 'g' },
      { ingredientName: 'Butter', quantity: 60, unit: 'g' },
      { ingredientName: 'Garlic', quantity: 3, unit: 'pcs' },
      { ingredientName: 'Salt', quantity: 4, unit: 'g' },
      { ingredientName: 'Pepper', quantity: 1, unit: 'g' },
    ],
  },
  {
    title: 'Tomato Rice Bowl',
    description: 'Steamed rice topped with fresh tomato and a drizzle of olive oil.',
    lines: [
      { ingredientName: 'Rice', quantity: 150, unit: 'g' },
      { ingredientName: 'Tomato', quantity: 2, unit: 'pcs' },
      { ingredientName: 'Olive Oil', quantity: 15, unit: 'ml' },
      { ingredientName: 'Salt', quantity: 3, unit: 'g' },
    ],
  },
  {
    title: 'Creamy Chicken and Vegetables',
    description: 'Pan-cooked chicken with vegetables in a light milk sauce.',
    lines: [
      { ingredientName: 'Chicken Breast', quantity: 300, unit: 'g' },
      { ingredientName: 'Onion', quantity: 1, unit: 'pcs' },
      { ingredientName: 'Carrot', quantity: 2, unit: 'pcs' },
      { ingredientName: 'Milk', quantity: 200, unit: 'ml' },
      { ingredientName: 'Butter', quantity: 20, unit: 'g' },
      { ingredientName: 'Salt', quantity: 4, unit: 'g' },
    ],
  },
];

export async function seed(prisma: PrismaClient): Promise<SeedResult> {
  const [ingCount, recCount] = await Promise.all([
    prisma.ingredient.count(),
    prisma.recipe.count(),
  ]);
  if (ingCount > 0 && recCount > 0) {
    return { ingredientsCreated: 0, recipesCreated: 0 };
  }

  let ingredientsCreated = 0;
  for (const ing of SEED_INGREDIENTS) {
    const before = await prisma.ingredient.findUnique({ where: { name: ing.name } });
    await prisma.ingredient.upsert({
      where: { name: ing.name },
      update: {},
      create: {
        name: ing.name,
        category: ing.category,
        defaultUnit: ing.baseUnit,
      },
    });
    if (!before) ingredientsCreated += 1;
  }

  const allIngredients = await prisma.ingredient.findMany({
    select: { id: true, name: true },
  });
  const idByName = new Map<string, string>(
    allIngredients.map((row) => [row.name, row.id] as const),
  );

  let recipesCreated = 0;
  for (const recipe of SEED_RECIPES) {
    const existing = await prisma.recipe.findFirst({ where: { title: recipe.title } });
    if (existing) continue;
    const created = await prisma.recipe.create({
      data: {
        title: recipe.title,
        description: recipe.description,
        servings: 1,
      },
    });
    const lines = recipe.lines
      .map((line) => {
        const ingredientId = idByName.get(line.ingredientName);
        if (!ingredientId) return null;
        return {
          recipeId: created.id,
          ingredientId,
          quantity: line.quantity,
          unit: line.unit,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
    if (lines.length > 0) {
      await prisma.recipeIngredient.createMany({ data: lines });
    }
    recipesCreated += 1;
  }

  return { ingredientsCreated, recipesCreated };
}