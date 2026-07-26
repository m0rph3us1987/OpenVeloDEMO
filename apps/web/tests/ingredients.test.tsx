import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Ingredients } from '../src/pages/Ingredients';

type IngredientRecord = {
  id: string;
  name: string;
  category: 'Meat' | 'Vegetables' | 'Dairy' | 'Grains' | 'Spices' | 'Other';
  baseUnit: 'g' | 'ml' | 'pcs';
};

const initial: IngredientRecord[] = [
  { id: '1', name: 'Salt', category: 'Spices', baseUnit: 'g' },
  { id: '2', name: 'Milk', category: 'Dairy', baseUnit: 'ml' },
  { id: '3', name: 'Apple', category: 'Vegetables', baseUnit: 'pcs' },
];

let state: IngredientRecord[] = [...initial];

function makeFetch(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.endsWith('/api/ingredients') && method === 'GET') {
      return new Response(JSON.stringify(state), { status: 200 });
    }
    if (url.endsWith('/api/ingredients') && method === 'POST') {
      const body = JSON.parse((init?.body as string) ?? '{}') as Omit<IngredientRecord, 'id'>;
      if (state.some((i) => i.name === body.name)) {
        return new Response(
          JSON.stringify({ error: 'duplicate', code: 'NAME_CONFLICT', details: [{ field: 'name', message: 'name must be unique' }] }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        );
      }
      const created: IngredientRecord = { id: `id-${state.length + 1}`, ...body };
      state = [...state, created];
      return new Response(JSON.stringify(created), { status: 201 });
    }
    const patchMatch = url.match(/\/api\/ingredients\/(.+)$/);
    if (patchMatch && method === 'PATCH') {
      const id = patchMatch[1];
      const body = JSON.parse((init?.body as string) ?? '{}') as Partial<IngredientRecord>;
      const idx = state.findIndex((i) => i.id === id);
      if (idx === -1) {
        return new Response(JSON.stringify({ error: 'not found', code: 'NOT_FOUND' }), { status: 404 });
      }
      const updated = { ...state[idx], ...body } as IngredientRecord;
      state = state.map((i) => (i.id === id ? updated : i));
      return new Response(JSON.stringify(updated), { status: 200 });
    }
    if (patchMatch && method === 'DELETE') {
      const id = patchMatch[1];
      if (!state.some((i) => i.id === id)) {
        return new Response(JSON.stringify({ error: 'not found', code: 'NOT_FOUND' }), { status: 404 });
      }
      state = state.filter((i) => i.id !== id);
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 500 });
  }) as unknown as typeof fetch;
}

function setup(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Ingredients />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state = [...initial];
  vi.stubGlobal('fetch', makeFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Ingredients page', () => {
  it('renders the loaded list with name, category, and base unit', async () => {
    setup();
    expect(await screen.findByText('Salt')).toBeInTheDocument();
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getAllByText('Dairy').length).toBeGreaterThan(0);
    expect(screen.getAllByText('pcs').length).toBeGreaterThan(0);
  });

  it('filters by a specific category', async () => {
    setup();
    await screen.findByText('Salt');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Dairy' }));
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.queryByText('Salt')).not.toBeInTheDocument();
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  });

  it('shows empty state when filter has no matches', async () => {
    setup();
    await screen.findByText('Salt');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Meat' }));
    expect(screen.getByText('No ingredients match this filter.')).toBeInTheDocument();
  });

  it('All Categories shows the full list', async () => {
    setup();
    await screen.findByText('Salt');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Meat' }));
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Salt')).toBeInTheDocument();
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });

  it('validates required fields and keeps user input', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));
    await user.type(screen.getByLabelText(/^Name$/), 'Tester');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText('Category is required')).toBeInTheDocument();
    expect(screen.getByText('Base unit is required')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name$/)).toHaveValue('Tester');
  });

  it('creates an ingredient and refreshes the list', async () => {
    setup();
    await screen.findByText('Salt');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));
    await user.type(screen.getByLabelText(/^Name$/), 'Rice');
    await user.selectOptions(screen.getByLabelText(/^Category$/), 'Grains');
    await user.selectOptions(screen.getByLabelText(/^Base unit$/), 'g');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.getByText('Rice')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
  });

  it('opens the edit form with prefilled values and saves changes', async () => {
    setup();
    await screen.findByText('Salt');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit Salt' }));
    const nameInput = await screen.findByLabelText(/^Name$/);
    expect(nameInput).toHaveValue('Salt');
    await user.clear(nameInput);
    await user.type(nameInput, 'Sea Salt');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Sea Salt')).toBeInTheDocument());
    expect(screen.queryByText('Salt')).not.toBeInTheDocument();
  });

  it('deletes an ingredient after confirmation', async () => {
    setup();
    await screen.findByText('Salt');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete Salt' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete Salt' }));
    await waitFor(() => expect(screen.queryByText('Salt')).not.toBeInTheDocument());
  });

  it('cancels delete when the user clicks Cancel', async () => {
    setup();
    await screen.findByText('Salt');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete Salt' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Salt')).toBeInTheDocument();
  });
});
