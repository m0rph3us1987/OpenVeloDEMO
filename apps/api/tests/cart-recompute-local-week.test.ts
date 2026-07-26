import { describe, expect, it } from 'vitest';
import { fetchCurrentWeek } from '../src/cart-recompute.js';
import { isoWeekFromDateLocal } from '../src/plan-utils.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('fetchCurrentWeek — local-date computation', () => {
  it('isoWeekFromDateLocal returns ISO week 1 for 2026-01-04 (Sunday)', () => {
    const sunday = new Date(2026, 0, 4);
    const { year, week } = isoWeekFromDateLocal(sunday);
    expect({ year, week }).toEqual({ year: 2026, week: 1 });
  });

  it('isoWeekFromDateLocal returns ISO week 1 of 2026 for Monday 2025-12-29', () => {
    // Monday 29 Dec 2025 is in ISO week 1 of 2026 per ISO 8601.
    const monday = new Date(2025, 11, 29);
    const { year, week } = isoWeekFromDateLocal(monday);
    expect({ year, week }).toEqual({ year: 2026, week: 1 });
  });

  it('fetchCurrentWeek returns a string matching the local ISO week', async () => {
    const label = await fetchCurrentWeek(prisma);
    expect(label).toMatch(/^\d{4}-W\d{2}$/);
    const { year, week } = isoWeekFromDateLocal(new Date());
    expect(label).toBe(
      `${year}-W${String(week).padStart(2, '0')}`,
    );
  });
});