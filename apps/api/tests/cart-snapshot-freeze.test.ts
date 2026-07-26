import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { freezeCartForWeek } from '../src/cart-snapshot.js';
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

describe('freezeCartForWeek', () => {
  beforeEach(async () => {
    await reset();
  });

  it('writes a CartHistory row whose itemsJson matches the aggregated groups', async () => {
    const week = currentWeek();
    const beef = await prisma.ingredient.create({
      data: { name: 'Beef', category: 'Meat', defaultUnit: 'g' },
    });
    await prisma.cartItem.create({
      data: {
        week,
        ingredientId: beef.id,
        unit: 'g',
        quantity: 250,
        source: 'manual',
        note: 'extra',
      },
    });
    const cart = await freezeCartForWeek(prisma, week);
    expect(cart.groups).toHaveLength(1);
    expect(cart.groups[0].items[0].manualQuantity).toBe(250);

    const history = await prisma.cartHistory.findUniqueOrThrow({
      where: { week },
    });
    const parsed = JSON.parse(history.itemsJson) as unknown;
    expect(parsed).toEqual(cart.groups);
  });

  it('is idempotent: re-freezing the same week state does not change takenAt or create a second row', async () => {
    const week = currentWeek();
    const first = await freezeCartForWeek(prisma, week);
    const firstTakenAt = await prisma.cartHistory.findUniqueOrThrow({
      where: { week },
    });

    // Re-freeze without any state change in between — must produce the same
    // response, leave takenAt unchanged, and not create a second row.
    const second = await freezeCartForWeek(prisma, week);
    expect(second).toEqual(first);

    const count = await prisma.cartHistory.count({ where: { week } });
    expect(count).toBe(1);
    const secondTakenAt = await prisma.cartHistory.findUniqueOrThrow({
      where: { week },
    });
    expect(secondTakenAt.takenAt.getTime()).toBe(firstTakenAt.takenAt.getTime());
  });
});