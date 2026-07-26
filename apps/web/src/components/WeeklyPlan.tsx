import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DAY_LABELS,
  DAY_SHORT_LABELS,
  fetchRecipes,
  markSlotCooked,
  type PlanResponse,
  type PlanSlotRecord,
} from '@/lib/plan';

export type WeeklyPlanProps = {
  week: PlanResponse;
  isCurrentWeek: boolean;
  currentDay: number | null;
  onAdd: (day: number) => void;
  onDelete: (slot: PlanSlotRecord) => void;
  onSlotChanged: () => void;
  onError: (message: string) => void;
  refreshRecipes: () => Promise<Awaited<ReturnType<typeof fetchRecipes>>>;
  setRecipesCache: (recipes: Awaited<ReturnType<typeof fetchRecipes>>) => void;
  cookedKey: (slotId: string) => string;
  markCookedLocally: (slotId: string) => void;
};

function dateForColumn(weekStart: string, day: number): string {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const d = new Date(start);
  d.setUTCDate(start.getUTCDate() + (day - 1));
  return d.toISOString().slice(0, 10);
}

function formatDayDate(dateString: string): { day: string; month: string; date: number } {
  const parsed = new Date(`${dateString}T00:00:00.000Z`);
  const day = parsed.getUTCDay();
  return {
    day: DAY_LABELS[(day + 6) % 7] ?? '',
    month: parsed.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
    date: parsed.getUTCDate(),
  };
}

export function WeeklyPlan(props: WeeklyPlanProps): JSX.Element {
  const {
    week,
    isCurrentWeek,
    currentDay,
    onAdd,
    onDelete,
    onSlotChanged,
    onError,
    refreshRecipes,
    setRecipesCache,
    cookedKey,
    markCookedLocally,
  } = props;
  const headingId = useId();
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const slotsByDay = new Map<number, PlanSlotRecord[]>();
  for (const slot of week.slots) {
    const list = slotsByDay.get(slot.day);
    if (list) {
      list.push(slot);
    } else {
      slotsByDay.set(slot.day, [slot]);
    }
  }

  const columns: Array<{ day: number; date: string }> = [];
  for (let day = 1; day <= 7; day += 1) {
    const date = dateForColumn(week.weekStart, day);
    columns.push({ day, date });
  }

  const handleCooked = async (slot: PlanSlotRecord): Promise<void> => {
    if (busyIds.has(slot.id)) {
      return;
    }
    const todayKey = new Date().toISOString().slice(0, 10);
    if (cookedKey(slot.id) === `${slot.id}:${todayKey}`) {
      onError('You already marked this slot as cooked today.');
      return;
    }
    setBusyIds((previous) => {
      const next = new Set(previous);
      next.add(slot.id);
      return next;
    });
    try {
      refreshRecipes().then(setRecipesCache).catch(() => undefined);
      const updated = await markSlotCooked(slot.id);
      markCookedLocally(slot.id);
      onSlotChanged();
      console.info(`[plan] cooked ${updated.id}, count=${updated.cookedCount}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed';
      onError(message);
    } finally {
      setBusyIds((previous) => {
        const next = new Set(previous);
        next.delete(slot.id);
        return next;
      });
    }
  };

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h3 id={headingId} className="text-base font-semibold">
        Weekly plan
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {columns.map((col) => {
          const date = col.date;
          const slotList = slotsByDay.get(col.day) ?? [];
          const isToday = isCurrentWeek && currentDay === col.day;
          const meta = date ? formatDayDate(date) : null;
          return (
            <div
              key={col.day}
              className={cn(
                'flex flex-col rounded-md border bg-background p-2',
                isToday ? 'border-accent ring-2 ring-ring' : 'border-muted',
              )}
              aria-label={`Day ${DAY_LABELS[col.day - 1] ?? ''}`}
            >
              <header className="flex items-baseline justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    {meta ? `${DAY_SHORT_LABELS[col.day - 1] ?? meta.day} ${meta.date}` : DAY_LABELS[col.day - 1] ?? ''}
                  </div>
                  {meta && (
                    <div className="text-xs opacity-70">{meta.month}</div>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Add planned meal to ${DAY_LABELS[col.day - 1] ?? ''}`}
                  onClick={() => onAdd(col.day)}
                >
                  + Add
                </Button>
              </header>
              <ul className="mt-2 space-y-2" aria-label={`Planned meals for ${DAY_LABELS[col.day - 1] ?? ''}`}>
                {slotList.map((slot) => {
                  const todayKey = new Date().toISOString().slice(0, 10);
                  const cookedToday = cookedKey(slot.id) === `${slot.id}:${todayKey}`;
                  return (
                    <li
                      key={slot.id}
                      className="rounded-md border border-muted bg-muted/30 p-2"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold">{slot.slot}</span>
                        <button
                          type="button"
                          aria-label={`Delete planned meal ${slot.recipeName}`}
                          className="text-xs text-red-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          onClick={() => onDelete(slot)}
                        >
                          X
                        </button>
                      </div>
                      <div className="mt-1 text-sm" data-testid="recipe-name">
                        {slot.recipeName}
                      </div>
                      {slot.notes && (
                        <p className="mt-1 text-xs opacity-80" aria-label="Notes">
                          {slot.notes}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={cookedToday ? 'outline' : 'default'}
                          disabled={cookedToday || busyIds.has(slot.id)}
                          aria-label={`I cooked ${slot.recipeName}`}
                          onClick={() => handleCooked(slot)}
                        >
                          {cookedToday ? 'Cooked ✓' : 'I cooked this'}
                        </Button>
                        <span className="text-xs opacity-70" aria-label="Times cooked">
                          {slot.cookedCount}× cooked
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {slotList.length === 0 && (
                <p className="mt-2 rounded-md border border-dashed border-muted p-2 text-center text-xs opacity-70">
                  Drop a recipe here
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
