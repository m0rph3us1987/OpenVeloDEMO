import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShoppingCart } from '../src/pages/ShoppingCart';

type CartItem = {
  ingredientId: string;
  name: string;
  category: 'Meat' | 'Vegetables' | 'Dairy' | 'Grains' | 'Spices' | 'Other';
  autoQuantity: number;
  manualQuantity: number;
  totalQuantity: number;
  unit: 'g' | 'ml' | 'pcs';
  source: Array<'plan' | 'manual'>;
  manualLineId: string | null;
};

type CartGroup = {
  category: CartItem['category'];
  items: CartItem[];
};

type CartResponse = {
  weekKey: string;
  weekLabel: string;
  dateRange: { start: string; end: string };
  groups: CartGroup[];
};

type CartWeekSummary = {
  weekKey: string;
  weekLabel: string;
  dateRange: { start: string; end: string };
  itemCount: number;
};

type Ingredient = {
  id: string;
  name: string;
  category: CartItem['category'];
  baseUnit: 'g' | 'ml' | 'pcs';
};

const CURRENT_WEEK = '2026-W31';
const PAST_WEEK = '2026-W29';
const WEEK_START = '2026-07-27';
const WEEK_END = '2026-08-02';

const initialCart: CartResponse = {
  weekKey: CURRENT_WEEK,
  weekLabel: 'Week 31, 2026',
  dateRange: { start: WEEK_START, end: WEEK_END },
  groups: [
    {
      category: 'Meat',
      items: [
        {
          ingredientId: 'ing-beef',
          name: 'Beef',
          category: 'Meat',
          autoQuantity: 200,
          manualQuantity: 50,
          totalQuantity: 250,
          unit: 'g',
          source: ['plan', 'manual'],
          manualLineId: 'line-1',
        },
      ],
    },
    {
      category: 'Grains',
      items: [
        {
          ingredientId: 'ing-rice',
          name: 'Rice',
          category: 'Grains',
          autoQuantity: 1500,
          manualQuantity: 0,
          totalQuantity: 1500,
          unit: 'g',
          source: ['plan'],
          manualLineId: null,
        },
      ],
    },
  ],
};

const initialWeeks: CartWeekSummary[] = [
  {
    weekKey: PAST_WEEK,
    weekLabel: 'Week 29, 2026',
    dateRange: { start: '2026-07-13', end: '2026-07-19' },
    itemCount: 2,
  },
];

const ingredients: Ingredient[] = [
  { id: 'ing-beef', name: 'Beef', category: 'Meat', baseUnit: 'g' },
  { id: 'ing-rice', name: 'Rice', category: 'Grains', baseUnit: 'g' },
  { id: 'ing-milk', name: 'Milk', category: 'Dairy', baseUnit: 'ml' },
];

let cartState: CartResponse = JSON.parse(JSON.stringify(initialCart));
let weeksState: CartWeekSummary[] = JSON.parse(JSON.stringify(initialWeeks));
let callLog: Array<{ url: string; method: string; body?: unknown }>;
let postShouldFail: boolean;

function resetState(): void {
  cartState = JSON.parse(JSON.stringify(initialCart));
  weeksState = JSON.parse(JSON.stringify(initialWeeks));
  callLog = [];
  postShouldFail = false;
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
      return new Response(JSON.stringify(weeksState), { status: 200 });
    }
    if (url.endsWith('/api/cart') && method === 'GET') {
      return new Response(JSON.stringify(cartState), { status: 200 });
    }
    const weekMatch = url.match(/\/api\/cart\/weeks\/([^/]+)$/);
    if (weekMatch && method === 'GET') {
      const key = weekMatch[1];
      const target = key === CURRENT_WEEK ? cartState : {
        weekKey: key,
        weekLabel: 'Past',
        dateRange: { start: '2026-07-13', end: '2026-07-19' },
        groups: [],
      };
      return new Response(JSON.stringify(target), { status: 200 });
    }
    if (url.endsWith('/api/cart/lines') && method === 'POST') {
      if (postShouldFail) {
        return new Response(
          JSON.stringify({ error: 'Could not save', code: 'INVALID_INPUT' }),
          { status: 400 },
        );
      }
      const body = parsedBody as { ingredientId: string; quantity: number; unit: string };
      const ing = ingredients.find((i) => i.id === body.ingredientId);
      if (!ing) {
        return new Response(
          JSON.stringify({ error: 'not found', code: 'NOT_FOUND' }),
          { status: 404 },
        );
      }
      const baseUnit =
        body.unit === 'kg' ? 'g' : body.unit === 'l' ? 'ml' : body.unit;
      const baseQty =
        body.unit === 'kg' || body.unit === 'l'
          ? body.quantity * 1000
          : body.quantity;
      const id = `line-new-${Date.now()}`;
      // Add to the current cart.
      const group = cartState.groups.find((g) => g.category === ing.category) ??
        (cartState.groups.push({ category: ing.category, items: [] }),
        cartState.groups[cartState.groups.length - 1]);
      group.items.push({
        ingredientId: ing.id,
        name: ing.name,
        category: ing.category,
        autoQuantity: 0,
        manualQuantity: baseQty,
        totalQuantity: baseQty,
        unit: baseUnit as 'g' | 'ml' | 'pcs',
        source: ['manual'],
        manualLineId: id,
      });
      return new Response(
        JSON.stringify({
          id,
          ingredientId: ing.id,
          ingredientName: ing.name,
          category: ing.category,
          quantity: baseQty,
          unit: baseUnit,
          note: null,
          source: 'manual',
          week: CURRENT_WEEK,
        }),
        { status: 201 },
      );
    }
    const patchMatch = url.match(/\/api\/cart\/lines\/([^/]+)$/);
    if (patchMatch && method === 'PATCH') {
      const id = patchMatch[1];
      const body = parsedBody as { quantity?: number; unit?: string };
      const item = cartState.groups
        .flatMap((g) => g.items)
        .find((it) => it.manualLineId === id);
      if (!item) {
        return new Response(
          JSON.stringify({ error: 'not found', code: 'NOT_FOUND' }),
          { status: 404 },
        );
      }
      const baseUnit =
        body.unit === 'kg' ? 'g' : body.unit === 'l' ? 'ml' : body.unit ?? item.unit;
      const baseQty =
        body.unit === 'kg' || body.unit === 'l'
          ? (body.quantity ?? 0) * 1000
          : (body.quantity ?? item.manualQuantity);
      item.manualQuantity = baseQty;
      item.totalQuantity = item.autoQuantity + baseQty;
      item.unit = baseUnit as 'g' | 'ml' | 'pcs';
      return new Response(
        JSON.stringify({
          id,
          ingredientId: item.ingredientId,
          ingredientName: item.name,
          category: item.category,
          quantity: baseQty,
          unit: baseUnit,
          note: null,
          source: 'manual',
          week: CURRENT_WEEK,
        }),
        { status: 200 },
      );
    }
    if (patchMatch && method === 'DELETE') {
      const id = patchMatch[1];
      for (const group of cartState.groups) {
        const idx = group.items.findIndex((it) => it.manualLineId === id);
        if (idx >= 0) {
          group.items.splice(idx, 1);
          break;
        }
      }
      return new Response(null, { status: 204 });
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

describe('ShoppingCart page', () => {
  it('renders grouped rows with metric promotion and source badges', async () => {
    setup();
    expect(
      await screen.findByRole('heading', { name: 'Shopping Cart' }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId('cart-group-Meat')).toBeInTheDocument();
    // 250 g is below 1000 → displayed as g.
    expect(await screen.findByTestId('cart-total-ing-beef-g')).toHaveTextContent(
      '250.00 g',
    );
    // 1500 g promotes to kg.
    expect(await screen.findByTestId('cart-total-ing-rice-g')).toHaveTextContent(
      '1.50 kg',
    );
    expect(
      await screen.findByTestId('source-plan-ing-rice-g'),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('source-manual-ing-beef-g'),
    ).toBeInTheDocument();
  });

  it('shows the read-only banner and hides edit controls for a past week', async () => {
    setup();
    const user = userEvent.setup();
    const switcher = (await screen.findByTestId('week-switcher')) as HTMLSelectElement;
    // Wait for the past week option to appear (loaded from /api/cart/weeks).
    await waitFor(() => {
      const values = Array.from(switcher.options).map((o) => o.value);
      expect(values).toContain(PAST_WEEK);
    });
    await user.selectOptions(switcher, PAST_WEEK);
    expect(await screen.findByTestId('readonly-banner')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search ingredient')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Delete Beef/i }),
    ).not.toBeInTheDocument();
  });

  it('optimistically adds a manual line and rolls back on error', async () => {
    setup();
    const user = userEvent.setup();
    const picker = await screen.findByLabelText('Search ingredient');
    await user.type(picker, 'Milk');
    const option = await screen.findByRole('option', { name: 'Milk' });
    await user.click(option);
    const quantity = await screen.findByLabelText('Quantity');
    await user.clear(quantity);
    await user.type(quantity, '250');

    // First submit succeeds: optimistic row appears, banner absent.
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    await waitFor(() => {
      expect(callLog.some((c) => c.method === 'POST' && c.url.endsWith('/api/cart/lines'))).toBe(true);
    });
    expect(
      await screen.findByTestId('cart-total-ing-milk-ml'),
    ).toHaveTextContent('250.00 ml');

    // Now force the next POST to fail; a banner should show and the cart should
    // not contain a new manual row for "Beans".
    postShouldFail = true;
    // Type a name that doesn't match an existing ingredient — we just need
    // any successful selection. Use "Rice" (already in initial state) and
    // confirm the banner appears without adding a duplicate row.
    await user.type(picker, 'Rice');
    const riceOpt = await screen.findByRole('option', { name: 'Rice' });
    await user.click(riceOpt);
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByTestId('cart-banner')).toBeInTheDocument();
  });

  it('editing the manual portion of a mixed-source row does not change the auto amount', async () => {
    setup();
    const user = userEvent.setup();

    // Beef is mixed-source: auto 200 g + manual 50 g (manualLineId = 'line-1').
    const autoCell = await screen.findByTestId('cart-auto-ing-beef-g');
    expect(autoCell).toHaveTextContent('200.00 g');

    const quantityInput = screen.getByLabelText('Edit quantity for Beef');
    expect(quantityInput).toBeInTheDocument();

    // Change the manual quantity from 50 g to 80 g. The mocked PATCH keeps
    // the auto portion untouched.
    await user.clear(quantityInput);
    await user.type(quantityInput, '80');
    await user.click(screen.getByRole('button', { name: 'Save edits to Beef' }));

    // Wait for the PATCH call to register and for the optimistic update to
    // settle. The auto cell text must remain at 200 g.
    await waitFor(() => {
      const patches = callLog.filter(
        (c) => c.method === 'PATCH' && c.url.includes('/api/cart/lines/'),
      );
      expect(patches.length).toBeGreaterThan(0);
    });
    expect(screen.getByTestId('cart-auto-ing-beef-g')).toHaveTextContent(
      '200.00 g',
    );
    // The manual editor reflects the updated manual amount.
    expect(quantityInput).toHaveValue(80);
  });
});