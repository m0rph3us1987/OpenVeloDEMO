import { useEffect, useId, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BASE_UNITS,
  BaseUnit,
  INGREDIENT_CATEGORIES,
  IngredientCategory,
} from '@openvelo/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type IngredientRecord = {
  id: string;
  name: string;
  category: IngredientCategory;
  baseUnit: BaseUnit;
};

type IngredientRequest = {
  name: string;
  category: IngredientCategory;
  baseUnit: BaseUnit;
};

const FILTER_ALL = 'All' as const;
type Filter = typeof FILTER_ALL | IngredientCategory;

const FILTERS: readonly Filter[] = [FILTER_ALL, ...INGREDIENT_CATEGORIES];

async function fetchIngredients(): Promise<IngredientRecord[]> {
  const res = await fetch('/api/ingredients');
  if (!res.ok) {
    throw new Error('Failed to load ingredients');
  }
  return res.json();
}

async function postIngredient(input: IngredientRequest): Promise<IngredientRecord> {
  const res = await fetch('/api/ingredients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await extractError(res));
  }
  return res.json();
}

async function patchIngredient(
  id: string,
  input: Partial<IngredientRequest>,
): Promise<IngredientRecord> {
  const res = await fetch(`/api/ingredients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await extractError(res));
  }
  return res.json();
}

async function deleteIngredient(id: string): Promise<void> {
  const res = await fetch(`/api/ingredients/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(await extractError(res));
  }
}

async function extractError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // ignore
  }
  return `Request failed (${res.status})`;
}

type FormState = {
  name: string;
  category: IngredientCategory | '';
  baseUnit: BaseUnit | '';
};

const EMPTY_FORM: FormState = { name: '', category: '', baseUnit: '' };

function validateForm(state: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!state.name.trim()) errors.name = 'Name is required';
  if (!state.category) errors.category = 'Category is required';
  if (!state.baseUnit) errors.baseUnit = 'Base unit is required';
  return errors;
}

function IngredientForm(props: {
  initial?: IngredientRecord;
  submitLabel: string;
  pending: boolean;
  errorMessage: string | null;
  onSubmit: (value: IngredientRequest) => void;
  onCancel: () => void;
}): JSX.Element {
  const { initial, submitLabel, pending, errorMessage, onSubmit, onCancel } = props;
  const [state, setState] = useState<FormState>(() =>
    initial
      ? { name: initial.name, category: initial.category, baseUnit: initial.baseUnit }
      : EMPTY_FORM,
  );
  const errors = useMemo(() => validateForm(state), [state]);
  const nameId = useId();
  const categoryId = useId();
  const unitId = useId();
  const formErrorId = useId();

  useEffect(() => {
    if (initial) {
      setState({ name: initial.name, category: initial.category, baseUnit: initial.baseUnit });
    }
  }, [initial]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (Object.keys(errors).length > 0) return;
    if (!state.category || !state.baseUnit) return;
    onSubmit({
      name: state.name.trim(),
      category: state.category,
      baseUnit: state.baseUnit,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-muted p-4 bg-muted/30"
      aria-label={initial ? 'Edit ingredient' : 'Add ingredient'}
    >
      <div>
        <label htmlFor={nameId} className="block text-sm font-medium">
          Name
        </label>
        <input
          id={nameId}
          name="name"
          type="text"
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
          className={cn(
            'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            errors.name ? 'border-red-500' : 'border-muted',
          )}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${nameId}-err` : undefined}
          required
        />
        {errors.name && (
          <p id={`${nameId}-err`} className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={categoryId} className="block text-sm font-medium">
          Category
        </label>
        <select
          id={categoryId}
          name="category"
          value={state.category}
          onChange={(e) => setState((s) => ({ ...s, category: e.target.value as IngredientCategory }))}
          className={cn(
            'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            errors.category ? 'border-red-500' : 'border-muted',
          )}
          aria-invalid={Boolean(errors.category)}
          aria-describedby={errors.category ? `${categoryId}-err` : undefined}
          required
        >
          <option value="" disabled>
            Select a category
          </option>
          {INGREDIENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {errors.category && (
          <p id={`${categoryId}-err`} className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
            {errors.category}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={unitId} className="block text-sm font-medium">
          Base unit
        </label>
        <select
          id={unitId}
          name="baseUnit"
          value={state.baseUnit}
          onChange={(e) => setState((s) => ({ ...s, baseUnit: e.target.value as BaseUnit }))}
          className={cn(
            'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            errors.baseUnit ? 'border-red-500' : 'border-muted',
          )}
          aria-invalid={Boolean(errors.baseUnit)}
          aria-describedby={errors.baseUnit ? `${unitId}-err` : undefined}
          required
        >
          <option value="" disabled>
            Select a unit
          </option>
          {BASE_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        {errors.baseUnit && (
          <p id={`${unitId}-err`} className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
            {errors.baseUnit}
          </p>
        )}
      </div>

      {errorMessage && (
        <p id={formErrorId} className="text-sm text-red-600 dark:text-red-400" role="alert" aria-live="polite">
          {errorMessage}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : submitLabel}
        </Button>
        {initial && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function ConfirmDelete(props: {
  ingredient: IngredientRecord;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  errorMessage: string | null;
}): JSX.Element {
  const { ingredient, pending, onConfirm, onCancel, errorMessage } = props;
  const titleId = useId();
  const errorId = useId();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-md border border-muted bg-background p-4 shadow-lg">
        <h3 id={titleId} className="text-base font-semibold">
          Delete ingredient?
        </h3>
        <p className="mt-1 text-sm opacity-80">
          Are you sure you want to delete <span className="font-medium">{ingredient.name}</span>?
        </p>
        {errorMessage && (
          <p id={errorId} role="alert" aria-live="polite" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending} aria-label={`Confirm delete ${ingredient.name}`}>
            {pending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Ingredients(): JSX.Element {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['ingredients'], queryFn: fetchIngredients });

  const create = useMutation({
    mutationFn: postIngredient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      setShowCreate(false);
      setCreateError(null);
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; input: Partial<IngredientRequest> }) =>
      patchIngredient(vars.id, vars.input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      setEditing(null);
      setEditError(null);
    },
    onError: (err: Error) => setEditError(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteIngredient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      setDeleting(null);
      setDeleteError(null);
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  const [filter, setFilter] = useState<Filter>(FILTER_ALL);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<IngredientRecord | null>(null);
  const [deleting, setDeleting] = useState<IngredientRecord | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = query.data ?? [];
    if (filter === FILTER_ALL) return list;
    return list.filter((i) => i.category === filter);
  }, [query.data, filter]);

  return (
    <section aria-labelledby="ingredients-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="ingredients-heading" className="text-2xl font-semibold">
          Ingredients
        </h2>
        <Button
          type="button"
          onClick={() => {
            setShowCreate((v) => !v);
            setCreateError(null);
          }}
          aria-expanded={showCreate}
          aria-controls="create-form"
        >
          {showCreate ? 'Close' : 'Add ingredient'}
        </Button>
      </div>

      {showCreate && (
        <div id="create-form">
          <IngredientForm
            submitLabel="Create"
            pending={create.isPending}
            errorMessage={createError}
            onSubmit={(value) => create.mutate(value)}
            onCancel={() => {
              setShowCreate(false);
              setCreateError(null);
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {FILTERS.map((f) => (
          <Button
            key={f}
            type="button"
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
          >
            {f}
          </Button>
        ))}
      </div>

      {query.isLoading && (
        <p role="status" aria-live="polite" className="text-sm opacity-80">
          Loading ingredients...
        </p>
      )}

      {query.isError && (
        <div
          role="alert"
          className="rounded-md border border-red-500 p-3 text-sm text-red-600 dark:text-red-400"
        >
          <p>Could not load ingredients.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => query.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {!query.isLoading && !query.isError && filtered.length === 0 && (
        <p className="text-sm opacity-80" role="status" aria-live="polite">
          No ingredients match this filter.
        </p>
      )}

      {!query.isLoading && !query.isError && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-muted">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Base unit</th>
                <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ingredient) => (
                <tr key={ingredient.id} className="border-t border-muted">
                  <td className="px-3 py-2">{ingredient.name}</td>
                  <td className="px-3 py-2">{ingredient.category}</td>
                  <td className="px-3 py-2">{ingredient.baseUnit}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(ingredient);
                          setEditError(null);
                        }}
                        aria-label={`Edit ${ingredient.name}`}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDeleting(ingredient);
                          setDeleteError(null);
                        }}
                        aria-label={`Delete ${ingredient.name}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div role="dialog" aria-modal="true" aria-label="Edit ingredient" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-md border border-muted bg-background p-4 shadow-lg">
            <h3 className="mb-2 text-base font-semibold">Edit ingredient</h3>
            <IngredientForm
              initial={editing}
              submitLabel="Save"
              pending={update.isPending}
              errorMessage={editError}
              onSubmit={(value) => update.mutate({ id: editing.id, input: value })}
              onCancel={() => {
                setEditing(null);
                setEditError(null);
              }}
            />
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDelete
          ingredient={deleting}
          pending={remove.isPending}
          errorMessage={deleteError}
          onConfirm={() => remove.mutate(deleting.id)}
          onCancel={() => {
            setDeleting(null);
            setDeleteError(null);
          }}
        />
      )}
    </section>
  );
}
