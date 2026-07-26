import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '../src/pages/Dashboard';

type Recipe = {
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

type PlanSlot = {
  id: string;
  day: number;
  date: string;
  slot: string;
  recipeId: string;
  recipeName: string;
  notes: string | null;
  cookedCount: number;
};

type PlanResponse = {
  week: string;
  weekStart: string;
  weekEnd: string;
  slots: PlanSlot[];
};

type StatsItem = {
  recipeId: string;
  recipeName: string;
  count: number;
  lastCookedAt: string | null;
};

type StatsResponse = {
  items: StatsItem[];
};

const CURRENT_WEEK = '2026-W31';
const WEEK_START = '2026-07-27';
const WEEK_END = '2026-08-02';

const recipesData: Recipe[] = [
  {
    id: 'rec-pasta',
    name: 'Pasta',
    ingredients: [{ ingredientId: 'ing-tomato', ingredientName: 'Tomato', quantity: 2, unit: 'pcs' }],
    timesCooked: 1,
  },
  {
    id: 'rec-soup',
    name: 'Soup',
    ingredients: [],
    timesCooked: 0,
  },
];

let planState: PlanResponse;
let statsState: StatsResponse;
let callLog: Array<{ url: string; method: string; body?: unknown }>;
let cookShouldFail: boolean;

function resetState(): void {
  planState = {
    week: CURRENT_WEEK,
    weekStart: WEEK_START,
    weekEnd: WEEK_END,
    slots: [
      {
        id: 'slot-1',
        day: 3,
        date: '2026-07-29',
        slot: 'Lunch',
        recipeId: 'rec-pasta',
        recipeName: 'Pasta',
        notes: null,
        cookedCount: 1,
      },
    ],
  };
  statsState = {
    items: [
      { recipeId: 'rec-pasta', recipeName: 'Pasta', count: 1, lastCookedAt: '2026-07-29T12:00:00.000Z' },
      { recipeId: 'rec-soup', recipeName: 'Soup', count: 0, lastCookedAt: null },
    ],
  };
  callLog = [];
  cookShouldFail = false;
}

function makeFetch(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    const bodyText = typeof init?.body === 'string' ? init.body : undefined;
    callLog.push({ url, method, body: bodyText ? JSON.parse(bodyText) : undefined });

    if (url.endsWith('/api/stats') && method === 'GET') {
      return new Response(JSON.stringify(statsState), { status: 200 });
    }
    if (url.includes('/api/plan?') && method === 'GET') {
      return new Response(JSON.stringify(planState), { status: 200 });
    }
    if (url.endsWith('/api/recipes') && method === 'GET') {
      return new Response(JSON.stringify(recipesData), { status: 200 });
    }

    const cookedMatch = url.match(/\/api\/plan\/([^/]+)\/cooked$/);
    if (cookedMatch && method === 'POST') {
      if (cookShouldFail) {
        return new Response(
          JSON.stringify({ error: 'Cook failed', code: 'COOK_FAILED' }),
          { status: 500 },
        );
      }
      const id = cookedMatch[1];
      const slot = planState.slots.find((s) => s.id === id);
      if (!slot) {
        return new Response(JSON.stringify({ error: 'not found', code: 'NOT_FOUND' }), { status: 404 });
      }
      slot.cookedCount += 1;
      const existing = statsState.items.find((it) => it.recipeId === slot.recipeId);
      const newTimestamp = new Date().toISOString();
      if (existing) {
        existing.count += 1;
        existing.lastCookedAt = newTimestamp;
      } else {
        statsState.items = [
          ...statsState.items,
          {
            recipeId: slot.recipeId,
            recipeName: slot.recipeName,
            count: 1,
            lastCookedAt: newTimestamp,
          },
        ];
      }
      const recipe = recipesData.find((r) => r.id === slot.recipeId);
      if (recipe) {
        recipe.timesCooked = (recipe.timesCooked ?? 0) + 1;
      }
      return new Response(JSON.stringify(slot), { status: 200 });
    }

    const idMatch = url.match(/\/api\/plan\/([^/?]+)$/);
    if (idMatch && method === 'DELETE') {
      const id = idMatch[1];
      const before = planState.slots.length;
      planState.slots = planState.slots.filter((s) => s.id !== id);
      if (planState.slots.length === before) {
        return new Response(JSON.stringify({ error: 'not found', code: 'NOT_FOUND' }), { status: 404 });
      }
      return new Response(null, { status: 204 });
    }

    if (idMatch && method === 'PATCH') {
      const id = idMatch[1];
      const slot = planState.slots.find((s) => s.id === id);
      if (!slot) {
        return new Response(JSON.stringify({ error: 'not found', code: 'NOT_FOUND' }), { status: 404 });
      }
      const body = JSON.parse(bodyText ?? '{}') as {
        day?: number;
        slot?: string;
        recipeId?: string;
        notes?: string | null;
      };
      if (body.day !== undefined) {
        slot.day = body.day;
        const start = new Date(`${WEEK_START}T00:00:00.000Z`);
        start.setUTCDate(start.getUTCDate() + (body.day - 1));
        slot.date = start.toISOString().slice(0, 10);
      }
      if (body.slot !== undefined) slot.slot = body.slot;
      if (body.recipeId !== undefined) {
        slot.recipeId = body.recipeId;
        const recipe = recipesData.find((r) => r.id === body.recipeId);
        slot.recipeName = recipe?.name ?? slot.recipeName;
      }
      if (body.notes !== undefined) slot.notes = body.notes;
      return new Response(JSON.stringify(slot), { status: 200 });
    }

    if (url.endsWith('/api/plan') && method === 'POST') {
      const body = JSON.parse(bodyText ?? '{}') as {
        day?: number;
        slot?: string;
        recipeId?: string;
        notes?: string;
      };
      const recipe = recipesData.find((r) => r.id === body.recipeId);
      const newSlot: PlanSlot = {
        id: `slot-new-${planState.slots.length + 1}`,
        day: body.day ?? 1,
        date: WEEK_START,
        slot: body.slot ?? 'Lunch',
        recipeId: body.recipeId ?? '',
        recipeName: recipe?.name ?? 'Recipe',
        notes: body.notes ?? null,
        cookedCount: 0,
      };
      planState.slots = [...planState.slots, newSlot];
      return new Response(JSON.stringify(newSlot), { status: 201 });
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
      <Dashboard />
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

describe('Dashboard page', () => {
  it('renders the weekly plan and cooked summary for the current week', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(await screen.findByText('Weekly plan')).toBeInTheDocument();
    expect((await screen.findAllByText('Pasta')).length).toBeGreaterThan(0);
    expect(
      await screen.findByRole('heading', { name: 'Total times cooked per recipe' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'I cooked Pasta' }),
    ).toBeInTheDocument();
  });

  it('renders every recipe in the stats table including never-cooked rows', async () => {
    setup();
    const table = await screen.findByTestId('stats-table');
    expect(within(table).getByText('Pasta')).toBeInTheDocument();
    expect(within(table).getByText('Soup')).toBeInTheDocument();
    expect(within(table).getByTestId('stats-count-rec-soup')).toHaveTextContent('0');
    expect(within(table).getByTestId('stats-last-rec-soup')).toHaveTextContent('—');
  });

  it('shows an accessible I cooked this button for every planned slot', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Add planned meal to Monday/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Add planned meal (Monday)' });
    await user.selectOptions(within(dialog).getByLabelText('Slot'), 'Dinner');
    await user.selectOptions(within(dialog).getByLabelText('Recipe'), 'rec-soup');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('button', { name: 'I cooked Soup' })).toBeEnabled();
    expect(await screen.findByRole('button', { name: 'I cooked Pasta' })).toBeEnabled();
  });

  it('issues a fresh POST per click and refreshes the count and last cooked date', async () => {
    setup();
    const user = userEvent.setup();
    const cook = await screen.findByRole('button', { name: 'I cooked Pasta' });
    await user.click(cook);

    await waitFor(() => {
      const table = screen.getByTestId('stats-table');
      expect(within(table).getByTestId('stats-count-rec-pasta')).toHaveTextContent('2');
    });

    const cookAgain = await screen.findByRole('button', { name: 'I cooked Pasta' });
    await user.click(cookAgain);

    await waitFor(() => {
      const table = screen.getByTestId('stats-table');
      expect(within(table).getByTestId('stats-count-rec-pasta')).toHaveTextContent('3');
    });

    const cooks = callLog.filter((c) => c.method === 'POST' && c.url.endsWith('/cooked'));
    expect(cooks).toHaveLength(2);
  });

  it('surfaces a failed cook POST in the banner and leaves the count unchanged', async () => {
    cookShouldFail = true;
    setup();
    const user = userEvent.setup();
    const cook = await screen.findByRole('button', { name: 'I cooked Pasta' });
    await user.click(cook);

    const matches = await screen.findAllByText('Cook failed (COOK_FAILED)');
    expect(matches.length).toBeGreaterThan(0);

    await waitFor(() => {
      const table = screen.getByTestId('stats-table');
      expect(within(table).getByTestId('stats-count-rec-pasta')).toHaveTextContent('1');
    });

    const cookbookCallCount = callLog.filter(
      (c) => c.method === 'POST' && c.url.endsWith('/cooked'),
    ).length;
    expect(cookbookCallCount).toBe(1);
    expect(await screen.findByRole('button', { name: 'I cooked Pasta' })).toBeEnabled();
  });

  it('opens the add dialog when the Add button is clicked and posts a new slot', async () => {
    setup();
    const user = userEvent.setup();
    const addButtons = await screen.findAllByRole('button', { name: /Add planned meal to Monday/i });
    await user.click(addButtons[0]);
    expect(await screen.findByRole('dialog', { name: 'Add planned meal (Monday)' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Slot'), 'Dinner');
    await user.selectOptions(screen.getByLabelText('Recipe'), 'rec-soup');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      const posts = callLog.filter((c) => c.method === 'POST' && c.url.endsWith('/api/plan'));
      expect(posts).toHaveLength(1);
      expect(posts[0].body).toMatchObject({ day: 1, slot: 'Dinner', recipeId: 'rec-soup' });
    });
  });

  it('opens the confirm dialog when delete is clicked and removes the slot', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete planned meal Pasta' }));
    expect(await screen.findByText('Are you sure? Remove this planned meal?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm delete planned meal' }));
    await waitFor(() => {
      const deletes = callLog.filter((c) => c.method === 'DELETE' && c.url.includes('slot-1'));
      expect(deletes).toHaveLength(1);
    });
  });

  it('switches the active week when next/previous arrows are used', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Next week' }));
    expect(callLog.some((c) => c.method === 'GET' && c.url.includes('/api/plan?week='))).toBe(true);
  });

  it('opens the edit dialog when the underlined recipe in the Planned slots table is clicked and saves the PATCH', async () => {
    setup();
    const user = userEvent.setup();
    const table = await screen.findByTestId('slot-table');
    const editButton = await within(table).findByRole('button', { name: 'Pasta' });
    await user.click(editButton);
    const dialog = await screen.findByRole('dialog', { name: 'Edit planned meal' });
    expect(within(dialog).getByLabelText('Slot')).toHaveValue('Lunch');
    expect(within(dialog).getByLabelText('Recipe')).toHaveValue('rec-pasta');
    await user.selectOptions(within(dialog).getByLabelText('Slot'), 'Dinner');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      const patches = callLog.filter(
        (c) => c.method === 'PATCH' && c.url.endsWith('/api/plan/slot-1'),
      );
      expect(patches).toHaveLength(1);
      expect(patches[0].body).toMatchObject({ slot: 'Dinner' });
    });
    await waitFor(() => {
      const updatedTable = screen.getByTestId('slot-table');
      expect(within(updatedTable).getAllByText('Dinner').length).toBeGreaterThan(0);
    });
  });

  it('surfaces a POST error in the banner and lets the user dismiss it', async () => {
    const failingFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();
      callLog.push({ url, method });
      if (url.endsWith('/api/stats') && method === 'GET') {
        return new Response(JSON.stringify(statsState), { status: 200 });
      }
      if (url.includes('/api/plan?') && method === 'GET') {
        return new Response(JSON.stringify(planState), { status: 200 });
      }
      if (url.endsWith('/api/recipes') && method === 'GET') {
        return new Response(JSON.stringify(recipesData), { status: 200 });
      }
      if (url.endsWith('/api/plan') && method === 'POST') {
        return new Response(
          JSON.stringify({ error: 'Server exploded', code: 'BOOM' }),
          { status: 500 },
        );
      }
      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', failingFetch);
    const user = userEvent.setup();
    setup();
    const addButtons = await screen.findAllByRole('button', { name: /Add planned meal to Monday/i });
    await user.click(addButtons[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Add planned meal (Monday)' });
    await user.selectOptions(within(dialog).getByLabelText('Slot'), 'Breakfast');
    await user.selectOptions(within(dialog).getByLabelText('Recipe'), 'rec-pasta');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    const matches = await screen.findAllByText('Server exploded (BOOM)');
    expect(matches.length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Dismiss error' }));
    await waitFor(() => {
      const remaining = screen.queryAllByText('Server exploded (BOOM)');
      expect(remaining).toHaveLength(1);
    });
  });
});
