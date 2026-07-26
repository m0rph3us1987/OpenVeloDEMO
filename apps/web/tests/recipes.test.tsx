import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Recipes } from '../src/pages/Recipes';

type IngredientRecord = {
  id: string;
  name: string;
  category: string;
  baseUnit: 'g' | 'ml' | 'pcs';
};

type RecipeRecord = {
  id: string;
  name: string;
  ingredients: Array<{
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unit: 'g' | 'ml' | 'pcs';
  }>;
  timesCooked: number;
};

const initialIngredients: IngredientRecord[] = [
  { id: 'ing-salt', name: 'Salt', category: 'Spices', baseUnit: 'g' },
  { id: 'ing-milk', name: 'Milk', category: 'Dairy', baseUnit: 'ml' },
  { id: 'ing-tomato', name: 'Tomato', category: 'Vegetables', baseUnit: 'pcs' },
];

const initialRecipes: RecipeRecord[] = [
  {
    id: 'rec-1',
    name: 'Salt Water',
    ingredients: [{ ingredientId: 'ing-salt', ingredientName: 'Salt', quantity: 1, unit: 'g' }],
    timesCooked: 2,
  },
  {
    id: 'rec-2',
    name: 'Milkshake',
    ingredients: [
      { ingredientId: 'ing-milk', ingredientName: 'Milk', quantity: 200, unit: 'ml' },
      { ingredientId: 'ing-salt', ingredientName: 'Salt', quantity: 0.5, unit: 'g' },
    ],
    timesCooked: 0,
  },
];

let recipes: RecipeRecord[];
let ingredients: IngredientRecord[];
let callLog: Array<{ url: string; method: string }>;

function makeFetch(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    callLog.push({ url, method });
    if (url.endsWith('/api/recipes') && method === 'GET') {
      return new Response(JSON.stringify(recipes), { status: 200 });
    }
    if (url.endsWith('/api/ingredients') && method === 'GET') {
      return new Response(JSON.stringify(ingredients), { status: 200 });
    }
    if (url.endsWith('/api/recipes') && method === 'POST') {
      const body = JSON.parse((init?.body as string) ?? '{}') as {
        name: string;
        ingredients: Array<{ ingredientId: string; quantity: number; unit: 'g' | 'ml' | 'pcs' }>;
      };
      const created: RecipeRecord = {
        id: `rec-${recipes.length + 1}`,
        name: body.name,
        ingredients: body.ingredients.map((row) => {
          const ingredient = ingredients.find((i) => i.id === row.ingredientId);
          return {
            ingredientId: row.ingredientId,
            ingredientName: ingredient?.name ?? row.ingredientId,
            quantity: row.quantity,
            unit: row.unit,
          };
        }),
        timesCooked: 0,
      };
      recipes = [...recipes, created];
      return new Response(JSON.stringify(created), { status: 201 });
    }
    const patchMatch = url.match(/\/api\/recipes\/(.+)$/);
    if (patchMatch && method === 'PATCH') {
      const id = patchMatch[1];
      const body = JSON.parse((init?.body as string) ?? '{}') as {
        name?: string;
        ingredients?: Array<{ ingredientId: string; quantity: number; unit: 'g' | 'ml' | 'pcs' }>;
      };
      const idx = recipes.findIndex((r) => r.id === id);
      if (idx === -1) {
        return new Response(JSON.stringify({ error: 'not found', code: 'NOT_FOUND' }), { status: 404 });
      }
      const existing = recipes[idx];
      const updated: RecipeRecord = {
        ...existing,
        name: body.name ?? existing.name,
        ingredients: body.ingredients
          ? body.ingredients.map((row) => {
              const ingredient = ingredients.find((i) => i.id === row.ingredientId);
              return {
                ingredientId: row.ingredientId,
                ingredientName: ingredient?.name ?? row.ingredientId,
                quantity: row.quantity,
                unit: row.unit,
              };
            })
          : existing.ingredients,
      };
      recipes = recipes.map((r) => (r.id === id ? updated : r));
      return new Response(JSON.stringify(updated), { status: 200 });
    }
    if (patchMatch && method === 'DELETE') {
      const id = patchMatch[1];
      if (!recipes.some((r) => r.id === id)) {
        return new Response(JSON.stringify({ error: 'not found', code: 'NOT_FOUND' }), { status: 404 });
      }
      recipes = recipes.filter((r) => r.id !== id);
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 500 });
  }) as unknown as typeof fetch;
}

function setup(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Recipes />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  recipes = [...initialRecipes];
  ingredients = [...initialIngredients];
  callLog = [];
  vi.stubGlobal('fetch', makeFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Recipes page', () => {
  it('renders existing recipes with name, ingredients, and times cooked', async () => {
    setup();
    expect(await screen.findByText('Salt Water')).toBeInTheDocument();
    expect(screen.getByText('Milkshake')).toBeInTheDocument();
    expect(screen.getAllByText('Salt').length).toBeGreaterThan(0);
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getAllByText('2 times').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0 times').length).toBeGreaterThan(0);
  });

  it('shows empty state when there are no recipes', async () => {
    recipes = [];
    setup();
    expect(await screen.findByText('No recipes yet — add your first one')).toBeInTheDocument();
  });

  it('requires a recipe name before saving', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add Recipe' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Recipe name is required')).toBeInTheDocument();
  });

  it('requires an ingredient selection for each row', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add Recipe' }));
    await user.type(screen.getByLabelText('Recipe name'), 'Test Recipe');
    await user.click(screen.getByRole('button', { name: 'Add row' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Pick an ingredient')).toBeInTheDocument();
  });

  it('requires a quantity greater than zero', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add Recipe' }));
    await user.type(screen.getByLabelText('Recipe name'), 'Test Recipe');
    await user.click(screen.getByRole('button', { name: 'Add row' }));
    const ingredientInput = screen.getByRole('combobox', { name: 'Ingredient' });
    await user.type(ingredientInput, 'Milk');
    await user.click(screen.getByRole('option', { name: 'Milk' }));
    await user.type(screen.getByLabelText('Quantity'), '0');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Quantity must be greater than 0')).toBeInTheDocument();
  });

  it('matches ingredient names case-insensitively in the picker', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add Recipe' }));
    await user.type(screen.getByLabelText('Recipe name'), 'Capital Match');
    await user.click(screen.getByRole('button', { name: 'Add row' }));
    const ingredientInput = screen.getByRole('combobox', { name: 'Ingredient' });
    await user.type(ingredientInput, 'MIL');
    expect(await screen.findByRole('option', { name: 'Milk' })).toBeInTheDocument();
  });

  it('persists a new recipe and shows it in the list', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add Recipe' }));
    await user.type(screen.getByLabelText('Recipe name'), 'Tomato Snack');
    await user.click(screen.getByRole('button', { name: 'Add row' }));
    await user.type(screen.getByRole('combobox', { name: 'Ingredient' }), 'Tomato');
    await user.click(screen.getByRole('option', { name: 'Tomato' }));
    await user.type(screen.getByLabelText('Quantity'), '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Tomato Snack')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('updates the recipes cache synchronously on create so subscribers see the new row before the refetch settles', async () => {
    setup();
    const user = userEvent.setup();
    const getsBefore = callLog.filter((c) => c.method === 'GET' && c.url.endsWith('/api/recipes')).length;
    await user.click(await screen.findByRole('button', { name: 'Add Recipe' }));
    await user.type(screen.getByLabelText('Recipe name'), 'Cache Hit');
    await user.click(screen.getByRole('button', { name: 'Add row' }));
    await user.type(screen.getByRole('combobox', { name: 'Ingredient' }), 'Salt');
    await user.click(screen.getByRole('option', { name: 'Salt' }));
    await user.type(screen.getByLabelText('Quantity'), '1');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Cache Hit')).toBeInTheDocument());
    const posts = callLog.filter((c) => c.method === 'POST' && c.url.endsWith('/api/recipes'));
    const getsAfter = callLog.filter((c) => c.method === 'GET' && c.url.endsWith('/api/recipes'));
    expect(posts).toHaveLength(1);
    expect(getsAfter.length - getsBefore).toBeLessThanOrEqual(1);
  });

  it('opens the edit dialog prefilled and saves changes', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Edit Salt Water' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit recipe' });
    const nameInput = screen.getByLabelText('Recipe name');
    expect(nameInput).toHaveValue('Salt Water');
    await user.clear(nameInput);
    await user.type(nameInput, 'Salted Water');
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Salted Water')).toBeInTheDocument());
    expect(screen.queryByRole('dialog', { name: 'Edit recipe' })).not.toBeInTheDocument();
  });

  it('shows the delete confirm and removes the recipe on confirm', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete Salt Water' }));
    expect(await screen.findByText('Delete this recipe?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm delete Salt Water' }));
    await waitFor(() => expect(screen.queryByText('Salt Water')).not.toBeInTheDocument());
  });

  it('cancels delete when the user clicks Cancel', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete Salt Water' }));
    expect(await screen.findByText('Delete this recipe?')).toBeInTheDocument();
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    await user.click(cancelButtons[0]);
    expect(screen.getByText('Salt Water')).toBeInTheDocument();
  });

  it('surfaces a 409 REFERENCED_BY_OTHER_RECORD inline when the API refuses deletion', async () => {
    const realFetch = makeFetch();
    let failureCount = 0;
    const fetchOverride: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();
      const match = url.match(/\/api\/recipes\/(.+)$/);
      if (match && method === 'DELETE') {
        failureCount += 1;
        return new Response(
          JSON.stringify({
            error: 'Recipe cannot be deleted because it is referenced by other records',
            code: 'REFERENCED_BY_OTHER_RECORD',
          }),
          { status: 409 },
        );
      }
      return realFetch(input, init);
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchOverride);

    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete Salt Water' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete Salt Water' }));
    expect(
      await screen.findByText(
        'Recipe cannot be deleted because it is referenced by other records (REFERENCED_BY_OTHER_RECORD)',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Salt Water')).toBeInTheDocument();
    expect(failureCount).toBe(1);
  });

  it('displays quantity with up to two decimals and trims trailing zeros', async () => {
    setup();
    expect(await screen.findByText('Salt Water')).toBeInTheDocument();
    const allText = document.body.textContent ?? '';
    expect(allText).toContain('1 g');
    expect(allText).toContain('0.5 g');
    expect(allText).toContain('200 ml');
  });
});
