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

const persisted: IngredientRecord[] = [
  { id: '1', name: 'Salt', category: 'Spices', baseUnit: 'g' },
  { id: '2', name: 'Milk', category: 'Dairy', baseUnit: 'ml' },
];

let calls: Array<{ url: string; method: string }> = [];
let failFirst = true;

function makeFetch(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ url, method });
    if (url.endsWith('/api/ingredients') && method === 'GET') {
      if (failFirst) {
        failFirst = false;
        return new Response(JSON.stringify({ error: 'boom' }), { status: 500 });
      }
      return new Response(JSON.stringify(persisted), { status: 200 });
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
  calls = [];
  failFirst = true;
  vi.stubGlobal('fetch', makeFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Ingredients page — persisted list recovery', () => {
  it('shows the error state, then renders persisted ingredients after Retry', async () => {
    setup();
    expect(await screen.findByText('Could not load ingredients.')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Salt')).toBeInTheDocument());
    expect(screen.getByText('Milk')).toBeInTheDocument();
    // Initial failed fetch + the retry-triggered refetch.
    const gets = calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/ingredients'));
    expect(gets.length).toBeGreaterThanOrEqual(2);
  });
});
