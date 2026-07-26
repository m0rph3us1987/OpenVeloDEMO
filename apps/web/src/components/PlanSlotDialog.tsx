import { useEffect, useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  createPlanSlot,
  DAY_LABELS,
  PLAN_SLOTS,
  patchPlanSlot,
  type PlanSlot,
  type PlanSlotRecord,
  type RecipeSummary,
} from '@/lib/plan';

export type PlanSlotDialogProps = {
  open: boolean;
  day: number | null;
  editing: PlanSlotRecord | null;
  onClose: () => void;
  onSuccess: (slot: PlanSlotRecord) => void;
  onError: (message: string) => void;
  refreshRecipes: () => Promise<RecipeSummary[]>;
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

async function httpCall<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json() as Promise<T>;
}

export function PlanSlotDialog(props: PlanSlotDialogProps): JSX.Element | null {
  const { open, day, editing, onClose, onSuccess, onError } = props;
  const titleId = useId();
  const slotId = useId();
  const recipeId = useId();
  const notesId = useId();
  const errorId = useId();
  const [slot, setSlot] = useState<PlanSlot | ''>('');
  const [recipeIdValue, setRecipeIdValue] = useState('');
  const [notes, setNotes] = useState('');
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [recipesPending, setRecipesPending] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setLocalError(null);
    if (editing) {
      setSlot((editing.slot as PlanSlot) ?? '');
      setRecipeIdValue(editing.recipeId);
      setNotes(editing.notes ?? '');
    } else {
      setSlot('');
      setRecipeIdValue('');
      setNotes('');
    }
  }, [open, editing]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setRecipesPending(true);
    const fetcher = props.refreshRecipes ?? (() => httpCall<RecipeSummary[]>('/api/recipes'));
    fetcher()
      .then((list) => {
        if (!cancelled) {
          setRecipes(list);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setLocalError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRecipesPending(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, props.refreshRecipes]);

  const sortedRecipes = useMemo(
    () => [...recipes].sort((a, b) => a.name.localeCompare(b.name)),
    [recipes],
  );

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!slot) {
      setLocalError('Pick a meal slot');
      return;
    }
    if (!recipeIdValue) {
      setLocalError('Pick a recipe');
      return;
    }
    setPending(true);
    setLocalError(null);
    try {
      let result: PlanSlotRecord;
      if (editing) {
        result = await patchPlanSlot(editing.id, {
          slot,
          recipeId: recipeIdValue,
          notes: notes === '' ? null : notes,
        });
      } else if (day !== null) {
        result = await createPlanSlot({
          day,
          slot,
          recipeId: recipeIdValue,
          notes: notes === '' ? undefined : notes,
        });
      } else {
        throw new Error('Missing day for new slot');
      }
      onSuccess(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed';
      setLocalError(message);
      onError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-md border border-muted bg-background p-4 shadow-lg">
        <h3 id={titleId} className="text-base font-semibold">
          {editing ? 'Edit planned meal' : 'Add planned meal'}
          {!editing && day !== null ? ` (${DAY_LABELS[day - 1] ?? ''})` : ''}
        </h3>
        <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
          <div>
            <label htmlFor={slotId} className="block text-sm font-medium">
              Slot
            </label>
            <select
              id={slotId}
              value={slot}
              onChange={(e) => setSlot(e.target.value as PlanSlot | '')}
              className={cn(
                'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                slot ? 'border-muted' : 'border-red-500',
              )}
              required
              disabled={pending}
            >
              <option value="" disabled>
                Select a slot
              </option>
              {PLAN_SLOTS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={recipeId} className="block text-sm font-medium">
              Recipe
            </label>
            <select
              id={recipeId}
              value={recipeIdValue}
              onChange={(e) => setRecipeIdValue(e.target.value)}
              className={cn(
                'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                recipeIdValue ? 'border-muted' : 'border-red-500',
              )}
              required
              disabled={pending || recipesPending}
            >
              <option value="" disabled>
                Select a recipe
              </option>
              {sortedRecipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={notesId} className="block text-sm font-medium">
              Notes (optional)
            </label>
            <textarea
              id={notesId}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={cn(
                'mt-1 w-full rounded-md border border-muted bg-background px-3 py-2 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              )}
              disabled={pending}
            />
          </div>
          {localError && (
            <p id={errorId} role="alert" aria-live="polite" className="text-sm text-red-600 dark:text-red-400">
              {localError}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : editing ? 'Save' : 'Add'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export type ConfirmDeleteDialogProps = {
  open: boolean;
  title?: string;
  message?: string;
  pending: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDeleteDialog(props: ConfirmDeleteDialogProps): JSX.Element | null {
  const {
    open,
    title = 'Are you sure?',
    message = 'Are you sure? Remove this planned meal?',
    pending,
    errorMessage,
    onConfirm,
    onCancel,
  } = props;
  const titleId = useId();
  const errorId = useId();
  if (!open) {
    return null;
  }
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-md border border-muted bg-background p-4 shadow-lg">
        <h3 id={titleId} className="text-base font-semibold">
          {title}
        </h3>
        <p className="mt-1 text-sm opacity-80">{message}</p>
        {errorMessage && (
          <p id={errorId} role="alert" aria-live="polite" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending} aria-label="Confirm delete planned meal">
            {pending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}
