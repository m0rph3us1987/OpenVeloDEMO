export const PLAN_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
export type PlanSlot = (typeof PLAN_SLOTS)[number];

const ISO_WEEK_REGEX = /^(\d{4})-W(0[1-9]|[1-4][0-9]|5[0-3])$/;

export function isIsoWeek(value: unknown): value is string {
  return typeof value === 'string' && ISO_WEEK_REGEX.test(value);
}

export function formatDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isoWeekFromDateUtc(date: Date): { year: number; week: number } {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNumber = target.getUTCDay() === 0 ? 7 : target.getUTCDay();
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { year: target.getUTCFullYear(), week: weekNumber };
}

export function formatIsoWeek(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function weekRangeFromIso(
  year: number,
  week: number,
): { weekStart: Date; weekEnd: Date } {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const weekStart = new Date(week1Monday);
  weekStart.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  return { weekStart, weekEnd };
}

export function parseIsoWeek(week: string): { year: number; week: number } {
  const match = ISO_WEEK_REGEX.exec(week);
  if (!match) {
    throw new Error(`Invalid ISO week label: ${week}`);
  }
  return { year: Number(match[1]), week: Number(match[2]) };
}

export interface WeekRange {
  week: string;
  weekStart: string;
  weekEnd: string;
}

export function currentWeekFromDate(date: Date): WeekRange {
  const { year, week } = isoWeekFromDateUtc(date);
  const { weekStart, weekEnd } = weekRangeFromIso(year, week);
  return {
    week: formatIsoWeek(year, week),
    weekStart: formatDateUtc(weekStart),
    weekEnd: formatDateUtc(weekEnd),
  };
}

export function shiftIsoWeek(week: string, delta: number): string {
  const parsed = parseIsoWeek(week);
  let { year, week: number } = parsed;
  number += delta;
  while (number < 1) {
    year -= 1;
    const lastWeek = weeksInIsoYear(year);
    number += lastWeek;
  }
  while (number > weeksInIsoYear(year)) {
    number -= weeksInIsoYear(year);
    year += 1;
  }
  return formatIsoWeek(year, number);
}

export function weeksInIsoYear(year: number): number {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dec31 = new Date(Date.UTC(year, 11, 31));
  const jan1Day = jan1.getUTCDay() === 0 ? 7 : jan1.getUTCDay();
  const dec31Day = dec31.getUTCDay() === 0 ? 7 : dec31.getUTCDay();
  if (jan1Day === 4 || dec31Day === 4) return 53;
  return 52;
}

export function resolveWeekFromInput(input: string | undefined | null): WeekRange {
  if (!input) {
    return currentWeekFromDate(new Date());
  }
  if (!isIsoWeek(input)) {
    throw new Error(`Invalid ISO week label: ${input}`);
  }
  const parsed = parseIsoWeek(input);
  const { weekStart, weekEnd } = weekRangeFromIso(parsed.year, parsed.week);
  return {
    week: formatIsoWeek(parsed.year, parsed.week),
    weekStart: formatDateUtc(weekStart),
    weekEnd: formatDateUtc(weekEnd),
  };
}

export type PlanSlotRecord = {
  id: string;
  day: number;
  date: string;
  slot: PlanSlot | string;
  recipeId: string;
  recipeName: string;
  notes: string | null;
  cookedCount: number;
};

export type PlanResponse = {
  week: string;
  weekStart: string;
  weekEnd: string;
  slots: PlanSlotRecord[];
};

export type StatsItem = {
  recipeId: string;
  recipeName: string;
  count: number;
  lastCookedAt: string | null;
};

export type StatsResponse = {
  items: StatsItem[];
};

export type RecipeSummary = {
  id: string;
  name: string;
  ingredients: Array<{
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unit: string;
  }>;
  timesCooked: number;
};

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; code?: string };
    if (data?.error) {
      return data.code ? `${data.error} (${data.code})` : data.error;
    }
  } catch {
    // ignore
  }
  return `Request failed (${res.status})`;
}

function api<T>(url: string, init?: RequestInit): Promise<T> {
  return fetch(url, init).then(async (res) => {
    if (!res.ok) {
      throw new Error(await parseError(res));
    }
    if (res.status === 204) {
      return undefined as T;
    }
    return res.json() as Promise<T>;
  });
}

export function fetchPlan(week: string): Promise<PlanResponse> {
  return api<PlanResponse>(`/api/plan?week=${encodeURIComponent(week)}`);
}

export function fetchStats(): Promise<StatsResponse> {
  return api<StatsResponse>('/api/stats');
}

export function fetchRecipes(): Promise<RecipeSummary[]> {
  return api<RecipeSummary[]>('/api/recipes');
}

export type PlanCreateInput = {
  week?: string;
  day: number;
  slot: PlanSlot;
  recipeId: string;
  notes?: string;
};

export type PlanPatchInput = {
  day?: number;
  slot?: PlanSlot;
  recipeId?: string;
  notes?: string | null;
};

export function createPlanSlot(input: PlanCreateInput): Promise<PlanSlotRecord> {
  return api<PlanSlotRecord>('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function patchPlanSlot(id: string, input: PlanPatchInput): Promise<PlanSlotRecord> {
  return api<PlanSlotRecord>(`/api/plan/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deletePlanSlot(id: string): Promise<void> {
  return api<void>(`/api/plan/${id}`, { method: 'DELETE' });
}

export function markSlotCooked(id: string): Promise<PlanSlotRecord> {
  return api<PlanSlotRecord>(`/api/plan/${id}/cooked`, { method: 'POST' });
}

export const DAY_LABELS: readonly string[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const DAY_SHORT_LABELS: readonly string[] = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
];

export function parseSlotDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function dayShortLabel(date: string): string {
  const parsed = parseSlotDate(date);
  const dow = parsed.getUTCDay();
  return DAY_SHORT_LABELS[(dow + 6) % 7] ?? '';
}

export function isPlanSlotValue(value: unknown): value is PlanSlot {
  return typeof value === 'string' && (PLAN_SLOTS as readonly string[]).includes(value);
}

export function currentWeekLabel(): string {
  return currentWeekFromDate(new Date()).week;
}
