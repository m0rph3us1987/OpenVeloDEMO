import { useEffect, useId, useMemo, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { IngredientCategory } from '@openvelo/types';
import { Button } from '@/components/ui/button';
import { IngredientPicker } from '@/components/IngredientPicker';
import { cn } from '@/lib/utils';
import {
  createCartLine,
  deleteCartLine,
  DISPLAY_UNITS,
  displayUnitsForBase,
  fetchCartWeeks,
  fetchCurrentCart,
  fetchWeekCart,
  formatDisplayQuantity,
  updateCartLine,
  type CartGroup,
  type CartItem,
  type CartLineInput,
  type CartLinePatch,
  type CartLineRecord,
  type CartResponse,
  type CartWeekSummary,
  type DisplayUnit,
} from '@/lib/cart';
import { currentWeekLabel } from '@/lib/plan';

type IngredientRecord = {
  id: string;
  name: string;
  category: IngredientCategory;
  baseUnit: 'g' | 'ml' | 'pcs';
};

async function fetchIngredients(): Promise<IngredientRecord[]> {
  const res = await fetch('/api/ingredients');
  if (!res.ok) {
    throw new Error('Failed to load ingredients');
  }
  return res.json() as Promise<IngredientRecord[]>;
}

function stepForUnit(unit: DisplayUnit): number {
  if (unit === 'pcs') return 1;
  if (unit === 'kg' || unit === 'l') return 0.1;
  return 0.1;
}

function defaultUnitForBase(base: 'g' | 'ml' | 'pcs'): DisplayUnit {
  return base;
}

function CategoryBadge(props: { category: IngredientCategory }): JSX.Element {
  return (
    <span
      className="inline-flex items-center rounded-full border border-muted bg-muted/40 px-2 py-0.5 text-xs font-medium"
      data-testid="category-badge"
    >
      {props.category}
    </span>
  );
}

function SourceBadges(props: {
  sources: CartItem['source'];
  editable: boolean;
  rowKey: string;
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1">
      {props.sources.includes('plan') && (
        <span
          className="inline-flex items-center rounded-full border border-accent bg-accent/15 px-2 py-0.5 text-xs"
          data-testid={`source-plan-${props.rowKey}`}
        >
          Plan
        </span>
      )}
      {props.sources.includes('manual') && (
        <span
          className="inline-flex items-center rounded-full border border-muted bg-background px-2 py-0.5 text-xs"
          data-testid={`source-manual-${props.rowKey}`}
        >
          Manual{props.editable ? '' : ' (read-only)'}
        </span>
      )}
    </span>
  );
}

type CartRowProps = {
  item: CartItem;
  editable: boolean;
  unitOptions: readonly DisplayUnit[];
  onSave: (input: CartLinePatch) => void;
  onDelete: () => void;
};

function CartRow(props: CartRowProps): JSX.Element {
  const { item, editable, unitOptions, onSave, onDelete } = props;
  // The editor is strictly about the manual amount. We initialise the
  // input from `item.manualQuantity` (NOT `item.manualQuantity ||
  // item.autoQuantity`) so that mixed-source rows can never edit the plan
  // amount. The displayed base unit is the row's stored base unit.
  const [quantity, setQuantity] = useState<string>(() =>
    String(formatDisplayQuantity(item.manualQuantity, item.unit).value),
  );
  const [unit, setUnit] = useState<DisplayUnit>(() =>
    defaultUnitForBase(item.unit),
  );
  const quantityId = useId();
  const unitId = useId();
  const rowKey = `${item.ingredientId}-${item.unit}-${item.manualLineId ?? 'auto'}`;

  // Reset the editor whenever the manual quantity, its base unit, or
  // the underlying line id changes from outside (e.g. server-side
  // invalidation swapping a manual line for a different one).
  useEffect(() => {
    setQuantity(
      String(formatDisplayQuantity(item.manualQuantity, item.unit).value),
    );
    setUnit(defaultUnitForBase(item.unit));
  }, [item.ingredientId, item.unit, item.manualQuantity, item.manualLineId]);

  function commit(): void {
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onSave({ quantity: parsed, unit });
  }

  const autoFmt = formatDisplayQuantity(item.autoQuantity, item.unit);
  const manualFmt = formatDisplayQuantity(item.manualQuantity, item.unit);
  const totalFmt = formatDisplayQuantity(item.totalQuantity, item.unit);
  const hasManual = item.source.includes('manual');

  return (
    <tr
      className="border-t border-muted"
      data-testid={`cart-row-${rowKey}`}
    >
      <td className="px-3 py-2 align-top">
        <div className="flex flex-col gap-1">
          <span className="font-medium" data-testid={`cart-name-${rowKey}`}>
            {item.name}
          </span>
          <CategoryBadge category={item.category} />
          <SourceBadges sources={item.source} editable={editable} rowKey={rowKey} />
        </div>
      </td>
      <td className="px-3 py-2 align-top text-sm" data-testid={`cart-auto-${rowKey}`}>
        <span className="block">{autoFmt.formatted}</span>
        <span className="block text-xs opacity-70">auto</span>
      </td>
      <td className="px-3 py-2 align-top text-sm" data-testid={`cart-manual-${rowKey}`}>
        {editable && hasManual ? (
          <div className="flex items-center gap-1">
            <input
              id={quantityId}
              type="number"
              min={0}
              step={stepForUnit(unit)}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onBlur={commit}
              aria-label={`Edit quantity for ${item.name}`}
              className={cn(
                'w-20 rounded-md border bg-background px-2 py-1 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'border-muted',
              )}
            />
            <select
              id={unitId}
              value={unit}
              onChange={(e) => setUnit(e.target.value as DisplayUnit)}
              onBlur={commit}
              aria-label={`Unit for ${item.name}`}
              className={cn(
                'rounded-md border bg-background px-2 py-1 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'border-muted',
              )}
            >
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={commit}
              aria-label={`Save edits to ${item.name}`}
            >
              Save
            </Button>
          </div>
        ) : (
          <span className="block">{manualFmt.formatted}</span>
        )}
      </td>
      <td className="px-3 py-2 align-top font-medium" data-testid={`cart-total-${rowKey}`}>
        {totalFmt.formatted}
      </td>
      <td className="px-3 py-2 align-top text-right">
        {editable && hasManual && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onDelete}
            aria-label={`Delete ${item.name}`}
          >
            Delete
          </Button>
        )}
      </td>
    </tr>
  );
}

type AddFormProps = {
  ingredients: IngredientRecord[];
  onSubmit: (input: CartLineInput) => void;
  pending: boolean;
  errorMessage: string | null;
};

function AddManualForm(props: AddFormProps): JSX.Element {
  const { ingredients, onSubmit, pending, errorMessage } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<DisplayUnit>('g');
  const [note, setNote] = useState('');
  const [validation, setValidation] = useState<string | null>(null);

  const selected = useMemo(
    () => ingredients.find((i) => i.id === selectedId) ?? null,
    [ingredients, selectedId],
  );

  const allowedUnits: readonly DisplayUnit[] = selected
    ? displayUnitsForBase(selected.baseUnit)
    : DISPLAY_UNITS;

  const errorId = useId();
  const quantityId = useId();
  const unitId = useId();
  const noteId = useId();

  useEffect(() => {
    if (selected) {
      const allowed = displayUnitsForBase(selected.baseUnit);
      setUnit((prev) => (allowed.includes(prev) ? prev : defaultUnitForBase(selected.baseUnit)));
    }
  }, [selected]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const qty = Number(quantity);
    if (!selectedId || !selected) {
      setValidation('Pick an ingredient');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setValidation('Quantity must be greater than 0');
      return;
    }
    const allowed = displayUnitsForBase(selected.baseUnit);
    if (!allowed.includes(unit)) {
      setValidation(
        `Unit must match the ingredient's allowed base units (${allowed.join(', ')})`,
      );
      return;
    }
    setValidation(null);
    onSubmit({
      ingredientId: selectedId,
      quantity: qty,
      unit,
      note: note.trim() || undefined,
    });
    setName('');
    setSelectedId(null);
    setQuantity('1');
    setNote('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-muted p-4 bg-muted/30"
      aria-label="Add manual cart line"
    >
      <h3 className="text-sm font-semibold">Add manual line</h3>
      <div className="grid gap-2 md:grid-cols-4">
        <div className="md:col-span-2">
          <IngredientPicker
            value={{ id: selectedId, name }}
            options={ingredients}
            onSelect={(opt) => {
              setSelectedId(opt.id);
              setName(opt.name);
            }}
            onQueryChange={(value) => {
              setName(value);
              setSelectedId(null);
            }}
            ariaLabel="Search ingredient"
          />
          {selected && (
            <p className="mt-1 text-xs opacity-80">Category: {selected.category}</p>
          )}
        </div>
        <div>
          <label htmlFor={quantityId} className="block text-sm font-medium">
            Quantity
          </label>
          <input
            id={quantityId}
            type="number"
            min={0}
            step={stepForUnit(unit)}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={cn(
              'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'border-muted',
            )}
            required
          />
        </div>
        <div>
          <label htmlFor={unitId} className="block text-sm font-medium">
            Unit
          </label>
          <select
            id={unitId}
            value={unit}
            onChange={(e) => setUnit(e.target.value as DisplayUnit)}
            className={cn(
              'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'border-muted',
            )}
          >
            {allowedUnits.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={noteId} className="block text-sm font-medium">
          Note (optional)
        </label>
        <input
          id={noteId}
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={cn(
            'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'border-muted',
          )}
        />
      </div>
      {(validation || errorMessage) && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {validation ?? errorMessage}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : 'Add to cart'}
        </Button>
      </div>
    </form>
  );
}

function applyLinePatchToCart(
  cart: CartResponse,
  line: CartLineRecord,
  mode: 'upsert' | 'delete',
): CartResponse {
  const groups: CartGroup[] = [];
  for (const group of cart.groups) {
    if (group.category !== line.category) {
      groups.push(group);
      continue;
    }
    if (mode === 'delete') {
      const items = group.items.filter((it) => it.manualLineId !== line.id);
      if (items.length > 0) {
        groups.push({ category: group.category, items });
      }
      continue;
    }
    // mode === 'upsert'
    const existingIndex = group.items.findIndex(
      (it) => it.manualLineId === line.id,
    );
    if (existingIndex >= 0) {
      // CRITICAL: preserve the existing autoQuantity — the PATCH endpoint
      // never modifies the plan amount, only the manual amount.
      const existing = group.items[existingIndex];
      const autoQuantity = existing.autoQuantity;
      const manualQuantity = line.quantity;
      const sources: CartItem['source'] = [];
      if (autoQuantity > 0) sources.push('plan');
      if (manualQuantity > 0) sources.push('manual');
      const items = [...group.items];
      items[existingIndex] = {
        ...existing,
        manualQuantity,
        totalQuantity: autoQuantity + manualQuantity,
        source: sources,
      };
      groups.push({ category: group.category, items });
      continue;
    }
    // No matching manual line — likely a newly created distinct line.
    // Append a new manual row in its category bucket.
    const items = [...group.items];
    items.push({
      ingredientId: line.ingredientId,
      name: line.ingredientName,
      category: line.category,
      autoQuantity: 0,
      manualQuantity: line.quantity,
      totalQuantity: line.quantity,
      unit: line.unit,
      source: line.quantity > 0 ? ['manual'] : [],
      manualLineId: line.id,
    });
    groups.push({ category: group.category, items });
  }
  if (
    mode === 'upsert' &&
    !groups.some((g) => g.category === line.category)
  ) {
    groups.push({
      category: line.category,
      items: [
        {
          ingredientId: line.ingredientId,
          name: line.ingredientName,
          category: line.category,
          autoQuantity: 0,
          manualQuantity: line.quantity,
          totalQuantity: line.quantity,
          unit: line.unit,
          source: line.quantity > 0 ? ['manual'] : [],
          manualLineId: line.id,
        },
      ],
    });
  }
  return { ...cart, groups };
}

export function ShoppingCart(): JSX.Element {
  const queryClient = useQueryClient();
  const currentWeek = useMemo(() => currentWeekLabel(), []);
  const [activeWeek, setActiveWeek] = useState<string>(currentWeek);
  const [banner, setBanner] = useState<string | null>(null);
  const isCurrent = activeWeek === currentWeek;

  const cartQuery = useQuery({
    queryKey: ['cart', activeWeek],
    queryFn: () => (isCurrent ? fetchCurrentCart() : fetchWeekCart(activeWeek)),
    enabled: Boolean(activeWeek),
  });

  const weeksQuery = useQuery({
    queryKey: ['cart-weeks'],
    queryFn: fetchCartWeeks,
  });

  const ingredientsQuery = useQuery({
    queryKey: ['ingredients'],
    queryFn: fetchIngredients,
    enabled: isCurrent,
  });

  const createMutation = useMutation({
    mutationFn: (input: CartLineInput) => createCartLine(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['cart', currentWeek] });
      const previous = queryClient.getQueryData<CartResponse>(['cart', currentWeek]);
      const ingredient = ingredientsQuery.data?.find((i) => i.id === input.ingredientId);
      if (previous && ingredient) {
        const placeholder: CartLineRecord = {
          id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ingredientId: input.ingredientId,
          ingredientName: ingredient.name,
          category: ingredient.category,
          quantity: input.quantity,
          unit: ingredient.baseUnit,
          note: input.note ?? null,
          source: 'manual',
          week: currentWeek,
        };
        queryClient.setQueryData<CartResponse>(['cart', currentWeek], (old) =>
          old ? applyLinePatchToCart(old, placeholder, 'upsert') : old,
        );
      }
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['cart', currentWeek], context.previous);
      }
      setBanner(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart', currentWeek] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CartLinePatch }) =>
      updateCartLine(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: ['cart', currentWeek] });
      const previous = queryClient.getQueryData<CartResponse>(['cart', currentWeek]);
      if (previous && input.quantity !== undefined && input.unit) {
        const placeholderBase =
          input.unit === 'kg' || input.unit === 'l'
            ? input.quantity * 1000
            : input.quantity;
        const placeholderUnit: 'g' | 'ml' | 'pcs' =
          input.unit === 'kg'
            ? 'g'
            : input.unit === 'l'
              ? 'ml'
              : input.unit;
        const matched = previous.groups
          .flatMap((g) => g.items)
          .find((it) => it.manualLineId === id);
        if (matched) {
          const placeholder: CartLineRecord = {
            id,
            ingredientId: matched.ingredientId,
            ingredientName: matched.name,
            category: matched.category,
            quantity: placeholderBase,
            unit: placeholderUnit,
            note: input.note ?? null,
            source: 'manual',
            week: currentWeek,
          };
          queryClient.setQueryData<CartResponse>(['cart', currentWeek], (old) =>
            old ? applyLinePatchToCart(old, placeholder, 'upsert') : old,
          );
        }
      }
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['cart', currentWeek], context.previous);
      }
      setBanner(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart', currentWeek] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCartLine(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['cart', currentWeek] });
      const previous = queryClient.getQueryData<CartResponse>(['cart', currentWeek]);
      if (previous) {
        const matched = previous.groups
          .flatMap((g) => g.items)
          .find((it) => it.manualLineId === id);
        if (matched) {
          const placeholder: CartLineRecord = {
            id,
            ingredientId: matched.ingredientId,
            ingredientName: matched.name,
            category: matched.category,
            quantity: 0,
            unit: matched.unit,
            note: null,
            source: 'manual',
            week: currentWeek,
          };
          queryClient.setQueryData<CartResponse>(['cart', currentWeek], (old) =>
            old ? applyLinePatchToCart(old, placeholder, 'delete') : old,
          );
        }
      }
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['cart', currentWeek], context.previous);
      }
      setBanner(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart', currentWeek] });
    },
  });

  const cart = cartQuery.data;
  const weeks = weeksQuery.data ?? [];
  const ingredients = ingredientsQuery.data ?? [];

  return (
    <section
      aria-labelledby="shopping-cart-heading"
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="shopping-cart-heading"
          className="text-2xl font-semibold"
        >
          Shopping Cart
        </h2>
        <div className="flex items-center gap-2">
          <label
            htmlFor="week-switcher"
            className="text-sm font-medium"
          >
            Week
          </label>
          <select
            id="week-switcher"
            value={activeWeek}
            onChange={(e) => setActiveWeek(e.target.value)}
            data-testid="week-switcher"
            className={cn(
              'rounded-md border bg-background px-3 py-2 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'border-muted',
            )}
          >
            <option value={currentWeek}>
              Current week ({currentWeek})
            </option>
            {weeks.map((w: CartWeekSummary) => (
              <option key={w.weekKey} value={w.weekKey}>
                {w.weekLabel}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!isCurrent && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-amber-500 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
          data-testid="readonly-banner"
        >
          Viewing {cart?.weekLabel ?? activeWeek} — read only
        </div>
      )}

      {banner && (
        <div
          role="alert"
          className="rounded-md border border-red-500 p-3 text-sm text-red-600 dark:text-red-400"
          data-testid="cart-banner"
        >
          <span>{banner}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={() => setBanner(null)}
            aria-label="Dismiss error"
          >
            Dismiss
          </Button>
        </div>
      )}

      {cartQuery.isLoading && (
        <p
          role="status"
          aria-live="polite"
          className="text-sm opacity-80"
          data-testid="cart-loading"
        >
          Loading cart...
        </p>
      )}

      {cartQuery.isError && (
        <div
          role="alert"
          className="rounded-md border border-red-500 p-3 text-sm text-red-600 dark:text-red-400"
        >
          <p>Could not load cart.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => cartQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {cart && !cartQuery.isLoading && !cartQuery.isError && (
        <>
          {cart.groups.length === 0 ? (
            <p
              role="status"
              aria-live="polite"
              className="text-sm opacity-80"
              data-testid="cart-empty"
            >
              Your cart is empty. Add an item below or plan a recipe.
            </p>
          ) : (
            <div className="space-y-4" data-testid="cart-groups">
              {cart.groups.map((group) => (
                <div
                  key={group.category}
                  className="overflow-x-auto rounded-md border border-muted"
                  data-testid={`cart-group-${group.category}`}
                >
                  <div className="bg-muted px-3 py-2 text-sm font-medium">
                    {group.category}
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">Ingredient</th>
                        <th className="px-3 py-2 font-medium">Auto</th>
                        <th className="px-3 py-2 font-medium">Manual</th>
                        <th className="px-3 py-2 font-medium">Total</th>
                        <th className="px-3 py-2">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <CartRow
                          key={`${item.ingredientId}-${item.unit}-${item.manualLineId ?? 'auto'}`}
                          item={item}
                          editable={isCurrent}
                          unitOptions={displayUnitsForBase(item.unit)}
                          onSave={(input) => {
                            if (!item.manualLineId) return;
                            updateMutation.mutate({ id: item.manualLineId, input });
                          }}
                          onDelete={() => {
                            if (!item.manualLineId) return;
                            deleteMutation.mutate(item.manualLineId);
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {isCurrent && (
            <AddManualForm
              ingredients={ingredients}
              pending={createMutation.isPending}
              errorMessage={createMutation.isError ? (createMutation.error as Error).message : null}
              onSubmit={(input) => createMutation.mutate(input)}
            />
          )}
        </>
      )}
    </section>
  );
}