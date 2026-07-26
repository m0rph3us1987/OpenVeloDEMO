import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { listCartWeeks } from '../src/cart-snapshot.js';
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

function pastWeek(offset: number): string {
  // ISO week arithmetic by shifting the current week key.
  const today = new Date();
  const utc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  utc.setUTCDate(utc.getUTCDate() - 7 * offset);
  const { year, week } = isoWeekFromDateUtc(utc);
  return formatIsoWeek(year, week);
}

function futureWeek(offset: number): string {
  const today = new Date();
  const utc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  utc.setUTCDate(utc.getUTCDate() + 7 * offset);
  const { year, week } = isoWeekFromDateUtc(utc);
  return formatIsoWeek(year, week);
}

describe('listCartWeeks — materialised history', () => {
  beforeEach(async () => {
    await reset();
  });

  it('returns a frozen past week that only has MealPlanSlot rows', async () => {
    const week = pastWeek(2);
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

    const list = await listCartWeeks(prisma);
    expect(list).toHaveLength(1);
    expect(list[0].weekKey).toBe(week);
    expect(list[0].itemCount).toBeGreaterThan(0);

    // A CartHistory snapshot is materialised.
    const hist = await prisma.cartHistory.findUnique({ where: { week } });
    expect(hist).not.toBeNull();
  });

  it('returns a frozen past week that only has CartItem rows', async () => {
    const week = pastWeek(1);
    const ing = await prisma.ingredient.create({
      data: { name: 'Salt', category: 'Spices', defaultUnit: 'g' },
    });
    await prisma.cartItem.create({
      data: {
        week,
        ingredientId: ing.id,
        unit: 'g',
        quantity: 10,
        source: 'manual',
      },
    });

    const list = await listCartWeeks(prisma);
    expect(list).toHaveLength(1);
    expect(list[0].weekKey).toBe(week);
    expect(list[0].itemCount).toBe(1);

    const hist = await prisma.cartHistory.findUnique({ where: { week } });
    expect(hist).not.toBeNull();
  });

  it('excludes future weeks even if they have plan rows', async () => {
    const week = futureWeek(1);
    const ing = await prisma.ingredient.create({
      data: { name: 'Rice', category: 'Grains', defaultUnit: 'g' },
    });
    const recipe = await prisma.recipe.create({ data: { title: 'Curry' } });
    await prisma.recipeIngredient.create({
      data: {
        recipeId: recipe.id,
        ingredientId: ing.id,
        quantity: 100,
        unit: 'g',
      },
    });
    await prisma.mealPlanSlot.create({
      data: {
        week,
        day: 1,
        date: new Date(),
        slot: 'Dinner',
        recipeId: recipe.id,
        servings: 1,
      },
    });

    const list = await listCartWeeks(prisma);
    expect(list.find((w) => w.weekKey === week)).toBeUndefined();
  });

  it('excludes the current week from history', async () => {
    const list = await listCartWeeks(prisma);
    expect(list.find((w) => w.weekKey === currentWeek())).toBeUndefined();
  });
});