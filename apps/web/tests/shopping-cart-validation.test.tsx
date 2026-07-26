import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShoppingCart } from '../src/pages/ShoppingCart';

type CartResponse = {
  weekKey: string;
  weekLabel: string;
  dateRange: { start: string; end: string };
  groups: Array<{ category: string; items: unknown[] }>;
};

type Ingredient = {
  id: string;
  name: string;
  category: 'Meat' | 'Vegetables' | 'Dairy' | 'Grains' | 'Spices' | 'Other';
  baseUnit: 'g' | 'ml' | 'pcs';
};

const CURRENT_WEEK = '2026-W31';
const WEEK_START = '2026-07-27';
const WEEK_END = '2026-08-02';

const emptyCart: CartResponse = {
  weekKey: CURRENT_WEEK,
  weekLabel: 'Week 31, 2026',
  dateRange: { start: WEEK_START, end: WEEK_END },
  groups: [],
};

const ingredients: Ingredient[] = [
  { id: 'ing-beef', name: 'Beef', category: 'Meat', baseUnit: 'g' },
  { id: 'ing-rice', name: 'Rice', category: 'Grains', baseUnit: 'g' },
  { id: 'ing-milk', name: 'Milk', category: 'Dairy', baseUnit: 'ml' },
];

let callLog: Array<{ url: string; method: string; body?: unknown }>;

function resetState(): void {
  callLog = [];
}

function makeFetch(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    const bodyText = typeof init?.body === 'string' ? init.body : undefined;
    const parsedBody = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : undefined;
    callLog.push({ url, method, body: parsedBody });

    if (url.endsWith('/api/ingredients') && method === 'GET') {
      return new Response(JSON.stringify(ingredients), { status: 200 });
    }
    if (url.endsWith('/api/cart/weeks') && method === 'GET') {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.endsWith('/api/cart') && method === 'GET') {
      return new Response(JSON.stringify(emptyCart), { status: 200 });
    }
    if (url.endsWith('/api/cart/lines') && method === 'POST') {
      const id = `line-new-${Date.now()}`;
      const body = parsedBody as { ingredientId: string; quantity: number; unit: string };
      return new Response(
        JSON.stringify({
          id,
          ingredientId: body.ingredientId,
          ingredientName: ingredients.find((i) => i.id === body.ingredientId)?.name ?? '',
          category: 'Meat',
          quantity: body.unit === 'kg' || body.unit === 'l' ? body.quantity * 1000 : body.quantity,
          unit: body.unit === 'kg' ? 'g' : body.unit === 'l' ? 'ml' : body.unit,
          note: null,
          source: 'manual',
          week: CURRENT_WEEK,
        }),
        { status: 201 },
      );
    }
    return new Response(null, { status: 500 });
  }) as unknown as typeof fetch;
}

function setup(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ShoppingCart />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  resetState();
  vi.stubGlobal('fetch', makeFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function postsToCartLines(): typeof callLog {
  return callLog.filter((c) => c.method === 'POST' && c.url.endsWith('/api/cart/lines'));
}

describe('ShoppingCart AddManualForm validation', () => {
  it('reports a missing quantity (not "Pick an ingredient") when an ingredient is selected and quantity is empty', async () => {
    setup();
    const user = userEvent.setup();

    const picker = await screen.findByLabelText('Search ingredient');
    await user.type(picker, 'Beef');
    await user.click(await screen.findByRole('option', { name: 'Beef' }));

    const quantity = await screen.findByLabelText('Quantity');
    await user.clear(quantity);

    await user.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Quantity/i);
    expect(screen.queryByText(/Pick an ingredient/i)).not.toBeInTheDocument();
    expect(postsToCartLines()).toHaveLength(0);
  });

  it('reports "Pick an ingredient" when no ingredient is selected and quantity is valid', async () => {
    setup();
    const user = userEvent.setup();

    const quantity = await screen.findByLabelText('Quantity');
    await user.clear(quantity);
    await user.type(quantity, '250');

    await user.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Pick an ingredient/i);
    expect(postsToCartLines()).toHaveLength(0);
  });

  it('reports "Quantity is required" (not a stale message) when picker text is typed but no option is chosen and quantity is empty', async () => {
    setup();
    const user = userEvent.setup();

    const picker = await screen.findByLabelText('Search ingredient');
    await user.type(picker, 'Beef');

    const quantity = await screen.findByLabelText('Quantity');
    await user.clear(quantity);

    await user.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Quantity/i);
    expect(postsToCartLines()).toHaveLength(0);
  });

  it('clears any stale alert and POSTs exactly one line on a fully valid submission', async () => {
    setup();
    const user = userEvent.setup();

    const picker = await screen.findByLabelText('Search ingredient');
    await user.type(picker, 'Beef');
    await user.click(await screen.findByRole('option', { name: 'Beef' }));

    const quantity = await screen.findByLabelText('Quantity');
    await user.clear(quantity);
    await user.type(quantity, '250');

    await user.click(screen.getByRole('button', { name: 'Add to cart' }));

    await waitFor(() => {
      expect(postsToCartLines()).toHaveLength(1);
    });
    const post = postsToCartLines()[0];
    expect(post.body).toEqual({
      ingredientId: 'ing-beef',
      quantity: 250,
      unit: 'g',
      note: undefined,
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});