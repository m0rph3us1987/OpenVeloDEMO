import { useEffect, useId, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BASE_UNITS, BaseUnit } from '@openvelo/types';
import { Button } from '@/components/ui/button';
import { IngredientPicker, type IngredientOption } from '@/components/IngredientPicker';
import { cn } from '@/lib/utils';
import { formatIngredientLabel, formatUnit } from '@/lib/labels';

type IngredientRecord = {
  id: string;
  name: string;
  category: string;
  baseUnit: BaseUnit;
};

type RecipeIngredientRecord = {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: BaseUnit;
};

type RecipeRecord = {
  id: string;
  name: string;
  ingredients: RecipeIngredientRecord[];
  timesCooked: number;
};

type RecipeInputIngredient = {
  ingredientId: string;
  quantity: number;
  unit: BaseUnit;
};

type RecipeRequest = {
  name: string;
  ingredients: RecipeInputIngredient[];
};

type RecipePatch = {
  name?: string;
  ingredients?: RecipeInputIngredient[];
};

async function fetchRecipes(): Promise<RecipeRecord[]> {
  const res = await fetch('/api/recipes');
  if (!res.ok) {
    throw new Error('Failed to load recipes');
  }
  return res.json();
}

async function fetchIngredients(): Promise<IngredientRecord[]> {
  const res = await fetch('/api/ingredients');
  if (!res.ok) {
    throw new Error('Failed to load ingredients');
  }
  return res.json();
}

async function createRecipe(input: RecipeRequest): Promise<RecipeRecord> {
  const res = await fetch('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await extractError(res));
  }
  return res.json();
}

async function patchRecipe(id: string, input: RecipePatch): Promise<RecipeRecord> {
  const res = await fetch(`/api/recipes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await extractError(res));
  }
  return res.json();
}

async function deleteRecipe(id: string): Promise<void> {
  const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(await extractError(res));
  }
}

async function extractError(res: Response): Promise<string> {
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

function formatQuantity(value: number): string {
  const fixed = value.toFixed(2);
  return fixed.replace(/\.?0+$/, '') || '0';
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

type RowState = {
  rowId: string;
  ingredientId: string | null;
  ingredientName: string;
  quantity: string;
  unit: BaseUnit | '';
  error?: string;
  qtyError?: string;
};

function newRow(): RowState {
  return {
    rowId: crypto.randomUUID(),
    ingredientId: null,
    ingredientName: '',
    quantity: '',
    unit: '',
  };
}

function rowFromIngredient(row: RecipeIngredientRecord): RowState {
  return {
    rowId: crypto.randomUUID(),
    ingredientId: row.ingredientId,
    ingredientName: row.ingredientName,
    quantity: String(row.quantity),
    unit: row.unit,
  };
}

type EditorProps = {
  initialName: string;
  initialRows: RowState[];
  ingredients: IngredientOption[];
  pending: boolean;
  errorMessage: string | null;
  submitLabel: string;
  onSubmit: (value: RecipeRequest) => void;
  onCancel: () => void;
};

function RecipeEditor(props: EditorProps): JSX.Element {
  const { initialName, initialRows, ingredients, pending, errorMessage, submitLabel, onSubmit, onCancel } = props;
  const [name, setName] = useState(initialName);
  const [rows, setRows] = useState<RowState[]>(initialRows);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameId = useId();
  const formErrorId = useId();

  useEffect(() => {
    setName(initialName);
    setRows(initialRows);
    setNameError(null);
  }, [initialName, initialRows]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    let hasError = false;
    const nextRows = rows.map((row) => {
      const trimmedQty = row.quantity.trim();
      const qty = trimmedQty === '' ? NaN : Number(trimmedQty);
      const ingredientError = row.ingredientId ? undefined : 'Pick an ingredient';
      const qtyError =
        !Number.isFinite(qty) || qty <= 0 ? 'Quantity must be greater than 0' : undefined;
      const unitError = row.unit ? undefined : 'Unit is required';
      const error = ingredientError ?? unitError;
      if (error || qtyError) {
        hasError = true;
      }
      return { ...row, error, qtyError };
    });
    setRows(nextRows);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Recipe name is required');
      hasError = true;
    } else {
      setNameError(null);
    }
    if (hasError) return;
    onSubmit({
      name: trimmedName,
      ingredients: nextRows.map((row) => ({
        ingredientId: row.ingredientId as string,
        quantity: Number(row.quantity),
        unit: row.unit as BaseUnit,
      })),
    });
  };

  const handleAddRow = (): void => {
    setRows((previous) => [...previous, newRow()]);
  };

  const handleRemoveRow = (rowId: string): void => {
    setRows((previous) => previous.filter((row) => row.rowId !== rowId));
  };

  const updateRow = (rowId: string, patch: Partial<RowState>): void => {
    setRows((previous) =>
      previous.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-muted p-4 bg-muted/30"
      aria-label="Recipe editor"
    >
      <div>
        <label htmlFor={nameId} className="block text-sm font-medium">
          Recipe name
        </label>
        <input
          id={nameId}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(null);
          }}
          className={cn(
            'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            nameError ? 'border-red-500' : 'border-muted',
          )}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? `${nameId}-err` : undefined}
        />
        {nameError && (
          <p id={`${nameId}-err`} className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
            {nameError}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Ingredients</span>
          <Button type="button" size="sm" variant="outline" onClick={handleAddRow} disabled={pending}>
            Add row
          </Button>
        </div>
        {rows.length === 0 && (
          <p className="text-xs opacity-80">No ingredients yet. Add a row to get started.</p>
        )}
        {rows.map((row) => (
          <div
            key={row.rowId}
            className="grid gap-2 rounded-md border border-muted bg-background p-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-start"
          >
            <div>
              <span className="sr-only">Ingredient</span>
              <IngredientPicker
                value={{ id: row.ingredientId, name: row.ingredientName }}
                options={ingredients}
                ariaLabel="Ingredient"
                onSelect={(option) =>
                  updateRow(row.rowId, {
                    ingredientId: option.id,
                    ingredientName: option.name,
                    unit: row.unit === '' ? option.baseUnit : row.unit,
                    error: undefined,
                  })
                }
                onQueryChange={(query) =>
                  updateRow(row.rowId, {
                    ingredientName: query,
                    ingredientId: null,
                    error: query === '' ? 'Pick an ingredient' : undefined,
                  })
                }
                error={row.error}
              />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor={`qty-${row.rowId}`}>
                Quantity
              </label>
              <input
                id={`qty-${row.rowId}`}
                type="number"
                min="0.0001"
                step="0.01"
                value={row.quantity}
                onChange={(e) => updateRow(row.rowId, { quantity: e.target.value, qtyError: undefined })}
                className={cn(
                  'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  row.qtyError ? 'border-red-500' : 'border-muted',
                )}
                aria-invalid={Boolean(row.qtyError)}
              />
              {row.qtyError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                  {row.qtyError}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor={`unit-${row.rowId}`}>
                Unit
              </label>
              <select
                id={`unit-${row.rowId}`}
                value={row.unit}
                onChange={(e) =>
                  updateRow(row.rowId, { unit: e.target.value as BaseUnit | '', error: undefined })
                }
                className={cn(
                  'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  row.error && !row.ingredientId ? 'border-red-500' : 'border-muted',
                )}
              >
                <option value="" disabled>
                  Select a unit
                </option>
                {BASE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {formatUnit(unit)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleRemoveRow(row.rowId)}
                disabled={pending}
                aria-label="Remove ingredient row"
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      {errorMessage && (
        <p id={formErrorId} className="text-sm text-red-600 dark:text-red-400" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            const fakeEvent = { preventDefault: () => {} } as unknown as React.FormEvent<HTMLFormElement>;
            handleSubmit(fakeEvent);
          }}
        >
          {pending ? 'Saving...' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ConfirmDeleteBlock(props: {
  recipe: RecipeRecord;
  pending: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element {
  const { recipe, pending, errorMessage, onConfirm, onCancel } = props;
  return (
    <div
      role="alertdialog"
      aria-label="Delete recipe"
      className="mt-2 rounded-md border border-red-500 p-3"
    >
      <p className="text-sm">Delete this recipe?</p>
      <p className="mt-1 text-xs opacity-80">
        {recipe.name} and its {recipe.ingredients.length} ingredient
        {recipe.ingredients.length === 1 ? '' : 's'} will be removed.
      </p>
      {errorMessage && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {errorMessage}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <Button type="button" onClick={onConfirm} disabled={pending} aria-label={`Confirm delete ${recipe.name}`}>
          {pending ? 'Deleting...' : 'Delete'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function Recipes(): JSX.Element {
  const queryClient = useQueryClient();
  const recipesQuery = useQuery({ queryKey: ['recipes'], queryFn: fetchRecipes });
  const ingredientsQuery = useQuery({ queryKey: ['ingredients'], queryFn: fetchIngredients });

  const create = useMutation({
    mutationFn: createRecipe,
    onSuccess: (created) => {
      queryClient.setQueryData<RecipeRecord[]>(['recipes'], (previous) => {
        const list = previous ?? [];
        const next = [...list, created];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setShowCreate(false);
      setCreateError(null);
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; input: RecipePatch }) => patchRecipe(vars.id, vars.input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setEditing(null);
      setEditError(null);
    },
    onError: (err: Error) => setEditError(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setDeleting(null);
      setDeleteError(null);
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<RecipeRecord | null>(null);
  const [deleting, setDeleting] = useState<RecipeRecord | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const ingredientOptions = useMemo<IngredientOption[]>(
    () =>
      (ingredientsQuery.data ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        baseUnit: i.baseUnit,
      })),
    [ingredientsQuery.data],
  );

  const recipes = recipesQuery.data ?? [];

  return (
    <section aria-labelledby="recipes-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="recipes-heading" className="text-2xl font-semibold">
          Recipes
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
          {showCreate ? 'Close' : 'Add Recipe'}
        </Button>
      </div>

      {showCreate && (
        <div id="create-form">
          <RecipeEditor
            initialName=""
            initialRows={[]}
            ingredients={ingredientOptions}
            pending={create.isPending}
            errorMessage={createError}
            submitLabel="Save"
            onSubmit={(value) => create.mutate(value)}
            onCancel={() => {
              setShowCreate(false);
              setCreateError(null);
            }}
          />
        </div>
      )}

      {recipesQuery.isLoading && (
        <p role="status" aria-live="polite" className="text-sm opacity-80">
          Loading recipes...
        </p>
      )}

      {recipesQuery.isError && (
        <div
          role="alert"
          className="rounded-md border border-red-500 p-3 text-sm text-red-600 dark:text-red-400"
        >
          <p>Could not load recipes.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => recipesQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {!recipesQuery.isLoading && !recipesQuery.isError && recipes.length === 0 && (
        <p className="text-sm opacity-80" role="status" aria-live="polite">
          No recipes yet — add your first one
        </p>
      )}

      {!recipesQuery.isLoading && !recipesQuery.isError && recipes.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-muted">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Ingredients</th>
                <th className="px-3 py-2 font-medium">Times cooked</th>
                <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((recipe) => (
                <tr key={recipe.id} className="border-t border-muted align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{recipe.name}</div>
                  </td>
                  <td className="px-3 py-2">
                    {recipe.ingredients.length === 0 ? (
                      <span className="opacity-80">No ingredients</span>
                    ) : (
                      <ul className="space-y-1">
                        {recipe.ingredients.map((row, index) => (
                          <li key={`${row.ingredientId}-${index}`}>
                            <span className="font-medium">{formatIngredientLabel(row.ingredientName)}</span>
                            <span className="opacity-80">
                              {' — '}
                              {formatQuantity(row.quantity)} {formatUnit(row.unit)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2">{pluralize(recipe.timesCooked, 'time', 'times')}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditing(recipe);
                            setEditError(null);
                          }}
                          aria-label={`Edit ${recipe.name}`}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDeleting(recipe);
                            setDeleteError(null);
                          }}
                          aria-label={`Delete ${recipe.name}`}
                        >
                          Delete
                        </Button>
                      </div>
                      {deleting?.id === recipe.id && (
                        <ConfirmDeleteBlock
                          recipe={recipe}
                          pending={remove.isPending}
                          errorMessage={deleteError}
                          onConfirm={() => remove.mutate(recipe.id)}
                          onCancel={() => {
                            setDeleting(null);
                            setDeleteError(null);
                          }}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit recipe"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-2xl rounded-md border border-muted bg-background p-4 shadow-lg">
            <h3 className="mb-2 text-base font-semibold">Edit recipe</h3>
            <RecipeEditor
              initialName={editing.name}
              initialRows={editing.ingredients.map(rowFromIngredient)}
              ingredients={ingredientOptions}
              pending={update.isPending}
              errorMessage={editError}
              submitLabel="Save"
              onSubmit={(value) =>
                update.mutate({
                  id: editing.id,
                  input: { name: value.name, ingredients: value.ingredients },
                })
              }
              onCancel={() => {
                setEditing(null);
                setEditError(null);
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
