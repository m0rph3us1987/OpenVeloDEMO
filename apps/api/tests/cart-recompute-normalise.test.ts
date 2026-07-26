import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { sumMealPlanSlots } from '../src/cart-recompute.js';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

function makeSlot(
  ingredientId: string,
  unit: string,
  quantity: number,
  servings = 1,
) {
  return {
    servings,
    recipe: {
      ingredients: [{ ingredientId, unit, quantity }],
    },
  };
}

describe('sumMealPlanSlots — defensive unit normalisation', () => {
  beforeEach(() => {
    // Pure JS helper — nothing to reset in the DB.
  });

  it('converts kg → g before building the aggregation key', () => {
    const baseUnits = new Map<string, 'g' | 'ml' | 'pcs'>([['ing-1', 'g']]);
    const totals = sumMealPlanSlots(
      [makeSlot('ing-1', 'kg', 2, 1)],
      baseUnits,
    );
    expect(totals.size).toBe(1);
    const row = totals.get('ing-1::g');
    expect(row).toEqual({ ingredientId: 'ing-1', unit: 'g', quantity: 2000 });
  });

  it('converts l → ml before building the aggregation key', () => {
    const baseUnits = new Map<string, 'g' | 'ml' | 'pcs'>([['ing-2', 'ml']]);
    const totals = sumMealPlanSlots(
      [makeSlot('ing-2', 'l', 0.5, 1)],
      baseUnits,
    );
    const row = totals.get('ing-2::ml');
    expect(row).toEqual({ ingredientId: 'ing-2', unit: 'ml', quantity: 500 });
  });

  it('skips recipe rows whose unit is incompatible with the ingredient base dimension', () => {
    const baseUnits = new Map<string, 'g' | 'ml' | 'pcs'>([['ing-3', 'g']]);
    const warnings: string[] = [];
    const totals = sumMealPlanSlots(
      [makeSlot('ing-3', 'pcs', 5, 1)],
      baseUnits,
      (msg) => warnings.push(msg),
    );
    expect(totals.size).toBe(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/does not match ingredient base dimension/);
  });

  it('sums mixed kg + g recipe rows into a single g bucket', () => {
    const baseUnits = new Map<string, 'g' | 'ml' | 'pcs'>([['ing-4', 'g']]);
    const totals = sumMealPlanSlots(
      [
        makeSlot('ing-4', 'kg', 1, 1), // 1000 g
        makeSlot('ing-4', 'g', 250, 1), // 250 g
      ],
      baseUnits,
    );
    const row = totals.get('ing-4::g');
    expect(row?.quantity).toBe(1250);
  });
});