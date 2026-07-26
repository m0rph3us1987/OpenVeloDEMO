import type { PlanApiError } from './errors.js';

export const PLAN_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
export type PlanSlot = (typeof PLAN_SLOTS)[number];

export function isPlanSlot(value: unknown): value is PlanSlot {
  return typeof value === 'string' && (PLAN_SLOTS as readonly string[]).includes(value);
}

const ISO_WEEK_REGEX = /^(\d{4})-W(0[1-9]|[1-4][0-9]|5[0-3])$/;

export function isIsoWeek(value: unknown): value is string {
  return typeof value === 'string' && ISO_WEEK_REGEX.test(value);
}

/**
 * Format a Date as YYYY-MM-DD using its UTC components. We standardise on
 * UTC for ISO calendar dates so the same week label is stable across
 * servers in different timezones.
 */
export function formatDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Compute the ISO week number for the given date (UTC). Returns
 * `{ year, week }`. Implements the algorithm from ISO 8601-1:2019.
 */
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

/**
 * Return the Monday and Sunday (UTC) for the given ISO year+week.
 * `dayOfWeek` 1 = Monday, 7 = Sunday.
 */
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
  const year = Number(match[1]);
  const wk = Number(match[2]);
  return { year, week: wk };
}

export interface WeekRange {
  week: string;
  weekStart: string;
  weekEnd: string;
}

export function resolveWeek(input?: string): WeekRange {
  let year: number;
  let week: number;
  if (input && isIsoWeek(input)) {
    const parsed = parseIsoWeek(input);
    year = parsed.year;
    week = parsed.week;
  } else if (input) {
    const err: PlanApiError = {
      error: 'Invalid week label',
      code: 'INVALID_WEEK',
    };
    throw new HttpError(400, err);
  } else {
    const today = new Date();
    const computed = isoWeekFromDateUtc(today);
    year = computed.year;
    week = computed.week;
  }
  const { weekStart, weekEnd } = weekRangeFromIso(year, week);
  return {
    week: formatIsoWeek(year, week),
    weekStart: formatDateUtc(weekStart),
    weekEnd: formatDateUtc(weekEnd),
  };
}

export function dateForDay(weekStart: string, day: number): Date {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const date = new Date(start);
  date.setUTCDate(start.getUTCDate() + (day - 1));
  return date;
}

export class HttpError extends Error {
  public readonly status: number;
  public readonly body: PlanApiError;

  constructor(status: number, body: PlanApiError) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}

export function fieldError(field: string, message: string): {
  field: string;
  message: string;
} {
  return { field, message };
}
