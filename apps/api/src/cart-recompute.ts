import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Recompute the auto-derived cart items for a single ISO week. Aggregates
 * every (week, day) → recipeIngredient tuple to a single summed
 * (ingredientId, unit) tuple. Manual cart items are preserved.
 *
 * Pass `prisma` and the optional transaction client `tx` to compose the
 * call within an outer `$transaction`. When `tx` is omitted, the call
 * executes directly on `prisma`.
 */
export async function recomputeAutoCartForWeek(
  prisma: PrismaClient,
  week: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;

  const slots = await client.mealPlanSlot.findMany({
    where: { week },
    include: {
      recipe: {
        include: { ingredients: true },
      },
    },
  });

  const totals = new Map<string, { ingredientId: string; unit: string; quantity: number }>();
  for (const slot of slots) {
    const factor = slot.servings && slot.servings > 0 ? slot.servings : 1;
    for (const row of slot.recipe.ingredients) {
      const key = `${row.ingredientId}::${row.unit}`;
      const previous = totals.get(key);
      const quantity = row.quantity * factor;
      if (previous) {
        previous.quantity += quantity;
      } else {
        totals.set(key, {
          ingredientId: row.ingredientId,
          unit: row.unit,
          quantity,
        });
      }
    }
  }

  await client.cartItem.deleteMany({ where: { week, source: 'auto' } });

  if (totals.size === 0) {
    return;
  }

  await client.cartItem.createMany({
    data: Array.from(totals.values()).map((row) => ({
      week,
      ingredientId: row.ingredientId,
      unit: row.unit,
      quantity: row.quantity,
      source: 'auto',
    })),
  });
}

export async function fetchCurrentWeek(prisma: PrismaClient): Promise<string> {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNumber = utc.getUTCDay() === 0 ? 7 : utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
