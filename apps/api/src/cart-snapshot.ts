import type { Prisma, PrismaClient } from '@prisma/client';
import {
  INGREDIENT_CATEGORIES,
  IngredientCategory,
} from '@openvelo/types';
import { HttpError, parseIsoWeek, resolveWeek } from './plan-utils.js';
import {
  fetchCurrentWeek,
  sumMealPlanSlots,
  unitToBase,
} from './cart-recompute.js';

export type DisplayUnit = 'g' | 'kg' | 'ml' | 'l' | 'pcs';

export const DISPLAY_UNITS: readonly DisplayUnit[] = [
  'g',
  'kg',
  'ml',
  'l',
  'pcs',
];

export type CartLineSource = 'plan' | 'manual';

export type CartItem = {
  ingredientId: string;
  name: string;
  category: IngredientCategory;
  autoQuantity: number;
  manualQuantity: number;
  totalQuantity: number;
  unit: 'g' | 'ml' | 'pcs';
  source: CartLineSource[];
  manualLineId: string | null;
};

export type CartGroup = {
  category: IngredientCategory;
  items: CartItem[];
};

export type CartResponse = {
  weekKey: string;
  weekLabel: string;
  dateRange: { start: string; end: string };
  groups: CartGroup[];
};

export type CartWeekSummary = {
  weekKey: string;
  weekLabel: string;
  dateRange: { start: string; end: string };
  itemCount: number;
};

export type CartLineRecord = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  category: IngredientCategory;
  quantity: number;
  unit: 'g' | 'ml' | 'pcs';
  note: string | null;
  source: 'auto' | 'manual';
  week: string;
};

// Re-exported from `cart-recompute.ts` so existing consumers of
// `cart-snapshot` keep working.
export { unitToBase } from './cart-recompute.js';

export function compareIsoWeek(a: string, b: string): -1 | 0 | 1 {
  const pa = parseIsoWeek(a);
  const pb = parseIsoWeek(b);
  if (pa.year !== pb.year) return pa.year < pb.year ? -1 : 1;
  if (pa.week !== pb.week) return pa.week < pb.week ? -1 : 1;
  return 0;
}

function shortMonthLabel(dateStr: string): string {
  // dateStr is "YYYY-MM-DD" in UTC. Months are stable and locale-friendly.
  const month = Number(dateStr.slice(5, 7));
  const day = Number(dateStr.slice(8, 10));
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[month - 1]} ${String(day).padStart(2, '0')}`;
}

export function formatWeekLabel(
  week: string,
  weekStart: string,
  weekEnd: string,
): string {
  const { year, week: number } = parseIsoWeek(week);
  const startLabel = shortMonthLabel(weekStart);
  const endLabel = shortMonthLabel(weekEnd);
  return `Week ${number}, ${year} · ${startLabel} – ${endLabel}`;
}

type ManualRow = Prisma.CartItemGetPayload<{ include: { ingredient: true } }>;

export function buildGroupsFromAggregation(
  autoTotals: Map<string, { ingredientId: string; unit: string; quantity: number }>,
  manualRows: ManualRow[],
  ingredientById: Map<
    string,
    { name: string; category: IngredientCategory; baseUnit: 'g' | 'ml' | 'pcs' }
  >,
  warn?: (message: string) => void,
): CartGroup[] {
  type Entry = {
    ingredientId: string;
    name: string;
    category: IngredientCategory;
    unit: 'g' | 'ml' | 'pcs';
    autoQuantity: number;
    manualQuantity: number;
    sources: Set<CartLineSource>;
    manualLineId: string | null;
  };

  const byKey = new Map<string, Entry>();

  for (const [key, row] of autoTotals) {
    const ing = ingredientById.get(row.ingredientId);
    if (!ing) continue;
    byKey.set(key, {
      ingredientId: row.ingredientId,
      name: ing.name,
      category: ing.category,
      unit: row.unit as 'g' | 'ml' | 'pcs',
      autoQuantity: row.quantity,
      manualQuantity: 0,
      sources: new Set<CartLineSource>(['plan']),
      manualLineId: null,
    });
  }

  for (const row of manualRows) {
    // Normalise the stored unit (`kg` → `g`, `l` → `ml`) before folding
    // into the group's base-unit bucket. Rows whose resolved unit is on
    // a different dimension than the ingredient's base unit (e.g. a
    // legacy `pcs` row for a `g`-base ingredient) are skipped with a
    // single warning.
    const normalized = unitToBase(row.unit);
    if (!normalized) {
      warn?.(
        `Skipping manual cart line ${row.id}: unsupported unit "${row.unit}"`,
      );
      continue;
    }
    const ing = ingredientById.get(row.ingredientId);
    if (ing && ing.baseUnit !== normalized.unit) {
      warn?.(
        `Skipping manual cart line ${row.id}: unit "${row.unit}" does not match ingredient base unit "${ing.baseUnit}"`,
      );
      continue;
    }
    const key = `${row.ingredientId}::${normalized.unit}`;
    const baseQuantity = row.quantity * normalized.factor;
    const existing = byKey.get(key);
    if (existing) {
      existing.manualQuantity += baseQuantity;
      existing.manualLineId = row.id;
    } else {
      const name = ing?.name ?? row.ingredient.name;
      const category =
        (ing?.category as IngredientCategory | undefined) ??
        (row.ingredient.category as IngredientCategory);
      byKey.set(key, {
        ingredientId: row.ingredientId,
        name,
        category,
        unit: normalized.unit,
        autoQuantity: 0,
        manualQuantity: baseQuantity,
        sources: new Set<CartLineSource>(['manual']),
        manualLineId: row.id,
      });
    }
    byKey.get(key)?.sources.add('manual');
  }

  const grouped = new Map<IngredientCategory, CartItem[]>();
  for (const entry of byKey.values()) {
    const total = entry.autoQuantity + entry.manualQuantity;
    const item: CartItem = {
      ingredientId: entry.ingredientId,
      name: entry.name,
      category: entry.category,
      autoQuantity: entry.autoQuantity,
      manualQuantity: entry.manualQuantity,
      totalQuantity: total,
      unit: entry.unit,
      source: Array.from(entry.sources),
      manualLineId: entry.manualLineId,
    };
    const list = grouped.get(entry.category) ?? [];
    list.push(item);
    grouped.set(entry.category, list);
  }

  for (const list of grouped.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const groups: CartGroup[] = [];
  for (const category of INGREDIENT_CATEGORIES) {
    const items = grouped.get(category);
    if (items && items.length > 0) {
      groups.push({ category, items });
    }
  }
  return groups;
}

type Client = PrismaClient | Prisma.TransactionClient;

export async function aggregateCartForWeek(
  client: Client,
  week: string,
): Promise<{
  groups: CartGroup[];
  itemCount: number;
}> {
  const [slots, manualRows, ingredients] = await Promise.all([
    client.mealPlanSlot.findMany({
      where: { week },
      include: { recipe: { include: { ingredients: true } } },
    }),
    client.cartItem.findMany({
      where: { week, source: 'manual' },
      include: { ingredient: true },
    }),
    client.ingredient.findMany({
      select: { id: true, name: true, category: true, defaultUnit: true },
    }),
  ]);

  const ingredientById = new Map<
    string,
    { name: string; category: IngredientCategory; baseUnit: 'g' | 'ml' | 'pcs' }
  >();
  const ingredientBaseUnit = new Map<string, 'g' | 'ml' | 'pcs'>();
  for (const i of ingredients) {
    const base = unitToBase(i.defaultUnit);
    const baseUnit = (base?.unit ?? 'pcs') as 'g' | 'ml' | 'pcs';
    ingredientById.set(i.id, {
      name: i.name,
      category: i.category as IngredientCategory,
      baseUnit,
    });
    ingredientBaseUnit.set(i.id, baseUnit);
  }

  const autoTotals = sumMealPlanSlots(slots, ingredientBaseUnit);

  const groups = buildGroupsFromAggregation(
    autoTotals,
    manualRows,
    ingredientById,
  );
  const itemCount = groups.reduce((sum, g) => sum + g.items.length, 0);
  return { groups, itemCount };
}

function buildCartResponse(
  week: string,
  groups: CartGroup[],
): CartResponse {
  const range = resolveWeek(week);
  const weekLabel = formatWeekLabel(range.week, range.weekStart, range.weekEnd);
  return {
    weekKey: range.week,
    weekLabel,
    dateRange: { start: range.weekStart, end: range.weekEnd },
    groups,
  };
}

export async function getCurrentCart(
  prisma: PrismaClient,
): Promise<CartResponse> {
  const current = await fetchCurrentWeek(prisma);
  const { groups } = await aggregateCartForWeek(prisma, current);
  return buildCartResponse(current, groups);
}

export async function freezeCartForWeek(
  prisma: PrismaClient,
  week: string,
): Promise<CartResponse> {
  return prisma.$transaction(async (tx) => {
    const { groups } = await aggregateCartForWeek(tx, week);
    const cart = buildCartResponse(week, groups);
    const itemsJson = JSON.stringify(cart.groups);
    const range = resolveWeek(week);
    await tx.cartHistory.upsert({
      where: { week },
      create: {
        week,
        weekStart: range.weekStart,
        weekEnd: range.weekEnd,
        weekLabel: cart.weekLabel,
        itemsJson,
      },
      update: {
        weekStart: range.weekStart,
        weekEnd: range.weekEnd,
        weekLabel: cart.weekLabel,
        itemsJson,
      },
    });
    return cart;
  });
}

export async function loadCartForWeek(
  prisma: PrismaClient,
  week: string,
  currentWeek: string,
): Promise<CartResponse> {
  if (compareIsoWeek(week, currentWeek) > 0) {
    throw new HttpError(404, {
      error: 'Cart not found',
      code: 'NOT_FOUND',
    });
  }
  if (week === currentWeek) {
    const { groups } = await aggregateCartForWeek(prisma, week);
    return buildCartResponse(week, groups);
  }
  const existing = await prisma.cartHistory.findUnique({ where: { week } });
  if (existing) {
    const groups = JSON.parse(existing.itemsJson) as CartGroup[];
    return {
      weekKey: existing.week,
      weekLabel: existing.weekLabel,
      dateRange: { start: existing.weekStart, end: existing.weekEnd },
      groups,
    };
  }
  return freezeCartForWeek(prisma, week);
}

export async function listCartWeeks(
  prisma: PrismaClient,
): Promise<CartWeekSummary[]> {
  // History summaries are derived from every persisted source of weekly
  // data: `CartHistory` snapshots (already frozen), `CartItem.week`
  // (manual entries that may not yet have been viewed), and
  // `MealPlanSlot.week` (planned slots that produced auto cart rows even
  // after the auto rows were wiped by a plan edit). Past weeks that
  // haven't yet been viewed are materialised lazily by `freezeCartForWeek`
  // so the response is complete on first call. Reads via
  // `loadCartForWeek` continue to prefer the frozen snapshot.
  const current = await fetchCurrentWeek(prisma);

  const [historyRows, cartItemWeeks, planWeeks] = await Promise.all([
    prisma.cartHistory.findMany({ select: { week: true } }),
    prisma.cartItem.findMany({
      where: { week: { not: current } },
      select: { week: true },
      distinct: ['week'],
    }),
    prisma.mealPlanSlot.findMany({
      where: { week: { not: current } },
      select: { week: true },
      distinct: ['week'],
    }),
  ]);

  const allWeeks = new Set<string>();
  for (const row of historyRows) allWeeks.add(row.week);
  for (const row of cartItemWeeks) allWeeks.add(row.week);
  for (const row of planWeeks) allWeeks.add(row.week);

  // Drop weeks strictly in the future — they cannot have archived data
  // we are willing to expose.
  for (const week of Array.from(allWeeks)) {
    if (compareIsoWeek(week, current) > 0) allWeeks.delete(week);
  }

  // Materialise a frozen CartHistory snapshot for any past week that
  // has archived data but no snapshot yet, so subsequent reads serve
  // from the snapshot and the response below can compute itemCount.
  for (const week of allWeeks) {
    const exists = await prisma.cartHistory.findUnique({
      where: { week },
      select: { id: true },
    });
    if (!exists) {
      await freezeCartForWeek(prisma, week);
    }
  }

  const summaries = await prisma.cartHistory.findMany({
    where: { week: { in: Array.from(allWeeks) } },
    orderBy: { week: 'desc' },
  });
  return summaries.map((row) => {
    const groups = JSON.parse(row.itemsJson) as CartGroup[];
    const itemCount = groups.reduce((sum, g) => sum + g.items.length, 0);
    return {
      weekKey: row.week,
      weekLabel: row.weekLabel,
      dateRange: { start: row.weekStart, end: row.weekEnd },
      itemCount,
    };
  });
}