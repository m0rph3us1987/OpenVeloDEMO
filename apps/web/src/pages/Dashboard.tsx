import { useId, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  ConfirmDeleteDialog,
  PlanSlotDialog,
} from '@/components/PlanSlotDialog';
import { WeeklyPlan } from '@/components/WeeklyPlan';
import {
  currentWeekLabel,
  deletePlanSlot,
  fetchPlan,
  fetchRecipes,
  fetchStats,
  PLAN_SLOTS,
  shiftIsoWeek,
  type PlanSlotRecord,
  type PlanSlot as PlanSlotType,
  type RecipeSummary,
  type StatsResponse,
} from '@/lib/plan';

const MS_PER_DAY = 86400000;

function cloneRecipes(list: RecipeSummary[]): RecipeSummary[] {
  return list.map((r) => ({
    ...r,
    ingredients: r.ingredients.map((i) => ({ ...i })),
  }));
}

function isPlanSlotValue(value: unknown): value is PlanSlotType {
  return typeof value === 'string' && (PLAN_SLOTS as readonly string[]).includes(value);
}

export function Dashboard(): JSX.Element {
  const queryClient = useQueryClient();
  const headingId = useId();
  const [activeWeek, setActiveWeek] = useState<string>(() => currentWeekLabel());
  const [serverNowWeek] = useState<string>(() => currentWeekLabel());
  const [banner, setBanner] = useState<string | null>(null);
  const [addDay, setAddDay] = useState<number | null>(null);
  const [editing, setEditing] = useState<PlanSlotRecord | null>(null);
  const [deleting, setDeleting] = useState<PlanSlotRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [cookedTracker, setCookedTracker] = useState<Set<string>>(new Set());

  const planQuery = useQuery({
    queryKey: ['plan', activeWeek],
    queryFn: () => fetchPlan(activeWeek),
  });

  const statsQuery = useQuery({
    queryKey: ['plan-stats', activeWeek],
    queryFn: () => fetchStats(activeWeek),
  });

  const recipesQuery = useQuery({
    queryKey: ['recipes'],
    queryFn: fetchRecipes,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePlanSlot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', activeWeek] });
      queryClient.invalidateQueries({ queryKey: ['plan-stats', activeWeek] });
      setDeleting(null);
      setDeleteError(null);
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  const plan = planQuery.data ?? null;
  const isCurrentWeek = activeWeek === serverNowWeek;

  const today = useMemo(() => {
    if (!plan) return null;
    const ms = Date.now();
    const todayUtc = new Date(Math.floor(ms / MS_PER_DAY) * MS_PER_DAY);
    for (const slot of plan.slots) {
      if (slot.date === todayUtc.toISOString().slice(0, 10)) {
        return slot.day;
      }
    }
    return null;
  }, [plan]);

  const handleError = (message: string): void => {
    setBanner(message);
  };

  const handleSlotChanged = (): void => {
    queryClient.invalidateQueries({ queryKey: ['plan', activeWeek] });
    queryClient.invalidateQueries({ queryKey: ['plan-stats', activeWeek] });
    if (activeWeek === serverNowWeek) {
      queryClient.invalidateQueries({ queryKey: ['cart', serverNowWeek] });
    }
  };

  const handlePrevious = (): void => {
    setActiveWeek((previous) => shiftIsoWeek(previous, -1));
  };

  const handleNext = (): void => {
    setActiveWeek((previous) => shiftIsoWeek(previous, 1));
  };

  const handleToday = (): void => {
    setActiveWeek(currentWeekLabel());
  };

  const handleAddDialogSuccess = (): void => {
    setAddDay(null);
    handleSlotChanged();
  };

  const handleEditDialogSuccess = (): void => {
    setEditing(null);
    handleSlotChanged();
  };

  const handleDelete = (): void => {
    if (!deleting) {
      return;
    }
    remove.mutate(deleting.id);
  };

  const markCookedLocally = (slotId: string): void => {
    const todayKey = new Date().toISOString().slice(0, 10);
    setCookedTracker((previous) => {
      const next = new Set(previous);
      next.add(`${slotId}:${todayKey}`);
      return next;
    });
  };

  return (
    <section aria-labelledby={headingId} className="space-y-6">
      <header className="space-y-1">
        <h2 id={headingId} className="text-2xl font-semibold">
          Dashboard
        </h2>
        <p className="text-sm opacity-80">
          Plan your meals for the week and track what you have cooked.
        </p>
      </header>

      {banner && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          <div className="flex items-center justify-between gap-2">
            <span>{banner}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setBanner(null)} aria-label="Dismiss error">
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <section aria-label="Weekly plan controls" className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handlePrevious} aria-label="Previous week">
          ←
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleNext} aria-label="Next week">
          →
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleToday} aria-label="Jump to current week">
          Today
        </Button>
        <span className="ml-2 text-sm font-medium">
          Week of {plan?.weekStart ?? activeWeek} – {plan?.weekEnd ?? activeWeek}
        </span>
      </section>

      {planQuery.isError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          Failed to load plan: {(planQuery.error as Error).message}
        </p>
      )}
      {planQuery.isLoading && (
        <p className="text-sm opacity-80" role="status" aria-live="polite">
          Loading plan...
        </p>
      )}

      {plan && (
        <WeeklyPlan
          week={plan}
          isCurrentWeek={isCurrentWeek}
          currentDay={today}
          onAdd={(day) => {
            setEditing(null);
            setAddDay(day);
          }}
          onDelete={(slot) => {
            setDeleting(slot);
          }}
          onSlotChanged={handleSlotChanged}
          onError={handleError}
          refreshRecipes={async () => {
            const recipes = recipesQuery.data ?? (await fetchRecipes());
            if (!recipesQuery.data) {
              queryClient.setQueryData(['recipes'], recipes);
            }
            return cloneRecipes(recipes);
          }}
          setRecipesCache={cloneRecipes}
          cookedKey={(slotId: string) => {
            const todayKey = new Date().toISOString().slice(0, 10);
            const key = `${slotId}:${todayKey}`;
            return cookedTracker.has(key) ? key : `${slotId}:none`;
          }}
          markCookedLocally={markCookedLocally}
        />
      )}

      {plan && (
        <div className="overflow-x-auto">
          <h3 className="text-base font-semibold">Planned slots</h3>
          <table className="mt-2 w-full text-sm" data-testid="slot-table">
            <thead className="text-left text-xs opacity-70">
              <tr>
                <th className="px-2 py-1">Day</th>
                <th className="px-2 py-1">Slot</th>
                <th className="px-2 py-1">Recipe</th>
                <th className="px-2 py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {plan.slots.map((slot) => (
                <tr
                  key={slot.id}
                  className="border-t border-muted"
                  data-testid="slot-row"
                >
                  <td className="px-2 py-1">{slot.day}</td>
                  <td className="px-2 py-1">{slot.slot}</td>
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      onClick={() => {
                        setAddDay(null);
                        setEditing(slot);
                      }}
                    >
                      {slot.recipeName}
                    </button>
                  </td>
                  <td className="px-2 py-1">{slot.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section aria-labelledby="summary-heading" className="space-y-2">
        <h3 id="summary-heading" className="text-base font-semibold">
          Total times cooked per recipe
        </h3>
        {statsQuery.isLoading && (
          <p className="text-sm opacity-80">Loading summary...</p>
        )}
        {statsQuery.isError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            Failed to load stats: {(statsQuery.error as Error).message}
          </p>
        )}
        {statsQuery.data && (
          <StatsTable
            stats={statsQuery.data}
            onError={handleError}
          />
        )}
      </section>

      <PlanSlotDialog
        open={addDay !== null}
        day={addDay}
        editing={editing}
        onClose={() => {
          setAddDay(null);
          setEditing(null);
        }}
        onSuccess={editing ? handleEditDialogSuccess : handleAddDialogSuccess}
        onError={handleError}
        refreshRecipes={async () =>
          cloneRecipes(recipesQuery.data ?? (await fetchRecipes()))
        }
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        pending={remove.isPending}
        errorMessage={deleteError}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
      />
    </section>
  );
}

function StatsTable(props: { stats: StatsResponse; onError: (msg: string) => void }): JSX.Element {
  const { stats, onError } = props;
  if (stats.items.length === 0) {
    return (
      <p className="text-sm opacity-80" data-testid="empty-stats">
        Nothing cooked yet this week.
      </p>
    );
  }
  return (
    <table className="w-full text-sm" data-testid="stats-table">
      <thead className="text-left text-xs opacity-70">
        <tr>
          <th className="px-2 py-1">Recipe</th>
          <th className="px-2 py-1">Times cooked</th>
          <th className="px-2 py-1">Last cooked</th>
        </tr>
      </thead>
      <tbody>
        {stats.items.map((item) => (
          <tr key={item.recipeId} className="border-t border-muted">
            <td className="px-2 py-1">{item.recipeName}</td>
            <td className="px-2 py-1">{item.count}</td>
            <td className="px-2 py-1">
              {item.lastCookedAt
                ? new Date(item.lastCookedAt).toLocaleDateString()
                : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const __test_only = {
  isPlanSlotValue,
};
