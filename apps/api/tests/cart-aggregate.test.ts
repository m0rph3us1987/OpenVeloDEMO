import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { aggregateCartForWeek } from '../src/cart-snapshot.js';
import {
  formatIsoWeek,
  isoWeekFromDateUtc,
} from '../src/plan-utils.js';

const prisma = new PrismaClient();

async function reset(): Promise<void> {
  await prisma.cartHistory.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cookLog.deleteMany();
  await prisma.mealPlanSlot.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.cartSnapshot.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.ingredient.deleteMany();
}

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

function currentWeek(): string {
  const today = new Date();
  const utc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const { year, week } = isoWeekFromDateUtc(utc);
  return formatIsoWeek(year, week);
}

describe('aggregateCartForWeek', () => {
  beforeEach(async () => {
    await reset();
  });

  it('returns empty groups when no plan or manual rows exist', async () => {
    const week = currentWeek();
    const result = await aggregateCartForWeek(prisma, week);
    expect(result.groups).toEqual([]);
    expect(result.itemCount).toBe(0);
  });

  it('aggregates planned recipe ingredients into an auto group and merges manual rows', async () => {
    const week = currentWeek();
    const beef = await prisma.ingredient.create({
      data: { name: 'Beef', category: 'Meat', defaultUnit: 'g' },
    });
    const recipe = await prisma.recipe.create({ data: { title: 'Stew' } });
    await prisma.recipeIngredient.create({
      data: {
        recipeId: recipe.id,
        ingredientId: beef.id,
        quantity: 200,
        unit: 'g',
      },
    });
    await prisma.mealPlanSlot.create({
      data: {
        week,
        day: 1,
        date: new Date(),
        slot: 'Lunch',
        recipeId: recipe.id,
        servings: 1,
      },
    });
    // No `CartItem` row for the plan exists — the aggregator computes the
    // auto total directly from MealPlanSlot → Recipe → RecipeIngredient.
    const result = await aggregateCartForWeek(prisma, week);
    const meatGroup = result.groups.find((g) => g.category === 'Meat');
    expect(meatGroup).toBeDefined();
    expect(meatGroup!.items).toHaveLength(1);
    const item = meatGroup!.items[0];
    expect(item.autoQuantity).toBe(200);
    expect(item.manualQuantity).toBe(0);
    expect(item.source).toEqual(['plan']);

    // Now add a manual line for the same ingredient.
    await prisma.cartItem.create({
      data: {
        week,
        ingredientId: beef.id,
        unit: 'g',
        quantity: 50,
        source: 'manual',
        note: 'extra',
      },
    });
    const result2 = await aggregateCartForWeek(prisma, week);
    const meatGroup2 = result2.groups.find((g) => g.category === 'Meat');
    expect(meatGroup2).toBeDefined();
    // Each manual row renders as a distinct item alongside any auto row.
    expect(meatGroup2!.items).toHaveLength(1);
    const item2 = meatGroup2!.items[0];
    expect(item2.autoQuantity).toBe(200);
    expect(item2.manualQuantity).toBe(50);
    expect(item2.totalQuantity).toBe(250);
    expect(item2.source).toEqual(['plan', 'manual']);
    expect(item2.manualLineId).toBeTruthy();
  });

  it('keeps multiple manual rows as separate response items', async () => {
    const week = currentWeek();
    const beef = await prisma.ingredient.create({
      data: { name: 'Beef', category: 'Meat', defaultUnit: 'g' },
    });
    await prisma.cartItem.create({
      data: {
        week,
        ingredientId: beef.id,
        unit: 'g',
        quantity: 100,
        source: 'manual',
      },
    });
    await prisma.cartItem.create({
      data: {
        week,
        ingredientId: beef.id,
        unit: 'g',
        quantity: 200,
        source: 'manual',
      },
    });
    const result = await aggregateCartForWeek(prisma, week);
    const meatGroup = result.groups.find((g) => g.category === 'Meat');
    expect(meatGroup).toBeDefined();
    expect(meatGroup!.items).toHaveLength(2);
    const manualIds = new Set(
      meatGroup!.items.map((it) => it.manualLineId).filter(Boolean),
    );
    expect(manualIds.size).toBe(2);
    const quantities = meatGroup!.items
      .map((it) => it.manualQuantity)
      .sort();
    expect(quantities).toEqual([100, 200]);
  });
});