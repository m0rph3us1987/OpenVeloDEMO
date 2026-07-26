import type { Prisma, PrismaClient } from '@prisma/client';
import { isoWeekFromDateLocal } from './plan-utils.js';

type BaseUnit = 'g' | 'ml' | 'pcs';

/**
 * Normalise a unit string to the app's base unit. Returns `null` for
 * unsupported values. The accepted set is `g`, `kg`, `ml`, `l`, `pcs`.
 * `kg` and `l` are converted to `g` and `ml` respectively with a factor
 * of 1000.
 */
export function unitToBase(
  unit: string,
): { unit: BaseUnit; factor: number } | null {
  switch (unit) {
    case 'g':
      return { unit: 'g', factor: 1 };
    case 'kg':
      return { unit: 'g', factor: 1000 };
    case 'ml':
      return { unit: 'ml', factor: 1 };
    case 'l':
      return { unit: 'ml', factor: 1000 };
    case 'pcs':
      return { unit: 'pcs', factor: 1 };
    default:
      return null;
  }
}

/**
 * Sum a list of MealPlanSlots (already joined with their Recipe.ingredients)
 * into a `(ingredientId, unit) → quantity` map. Pure JS; no DB access. Used
 * by both `recomputeAutoCartForWeek` (which persists the totals into the
 * `CartItem` table) and by `aggregateCartForWeek` (which builds a read-only
 * grouping without persisting).
 *
 * The function is defensive about recipe ingredient units:
 *  - Each row's `unit` is normalised to the ingredient's base unit
 *    (`kg → g`, `l → ml`) via `unitToBase` before being keyed into the map.
 *  - When the optional `ingredientBaseUnit` map is supplied, the resolved
 *    base unit is validated against the ingredient's `defaultUnit`. A row
 *    whose resolved unit is on a different dimension (e.g. `pcs` for a
 *    `g`-base ingredient) is skipped with a single warning.
 */
export function sumMealPlanSlots(
  slots: Array<{
    servings: number;
    recipe: {
      ingredients: Array<{
        ingredientId: string;
        unit: string;
        quantity: number;
      }>;
    };
  }>,
  ingredientBaseUnit?: Map<string, BaseUnit>,
  warn?: (message: string) => void,
): Map<string, { ingredientId: string; unit: string; quantity: number }> {
  const totals = new Map<
    string,
    { ingredientId: string; unit: string; quantity: number }
  >();
  for (const slot of slots) {
    const factor = slot.servings && slot.servings > 0 ? slot.servings : 1;
    for (const row of slot.recipe.ingredients) {
      const normalized = unitToBase(row.unit);
      if (!normalized) {
        warn?.(
          `Skipping recipe ingredient ${row.ingredientId}: unsupported unit "${row.unit}"`,
        );
        continue;
      }
      if (
        ingredientBaseUnit &&
        ingredientBaseUnit.get(row.ingredientId) !== normalized.unit
      ) {
        warn?.(
          `Skipping recipe ingredient ${row.ingredientId}: unit "${row.unit}" does not match ingredient base dimension`,
        );
        continue;
      }
      const key = `${row.ingredientId}::${normalized.unit}`;
      const baseQuantity = row.quantity * normalized.factor;
      const previous = totals.get(key);
      const quantity = baseQuantity * factor;
      if (previous) {
        previous.quantity += quantity;
      } else {
        totals.set(key, {
          ingredientId: row.ingredientId,
          unit: normalized.unit,
          quantity,
        });
      }
    }
  }
  return totals;
}

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

  const [slots, ingredients] = await Promise.all([
    client.mealPlanSlot.findMany({
      where: { week },
      include: { recipe: { include: { ingredients: true } } },
    }),
    client.ingredient.findMany({
      select: { id: true, defaultUnit: true },
    }),
  ]);

  const ingredientBaseUnit = new Map<string, BaseUnit>();
  for (const ing of ingredients) {
    const base = unitToBase(ing.defaultUnit);
    if (base) ingredientBaseUnit.set(ing.id, base.unit);
  }

  const totals = sumMealPlanSlots(slots, ingredientBaseUnit);

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

export async function fetchCurrentWeek(_prisma: PrismaClient): Promise<string> {
  const now = new Date();
  const { year, week } = isoWeekFromDateLocal(now);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
