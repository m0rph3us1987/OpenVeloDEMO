import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from '../src/pages/Settings';

type ResetResponse = {
  ok: true;
  reseeded: true;
  ingredients: number;
  recipes: number;
};

function setupFetch(behavior: 'success' | 'error'): {
  fetchMock: ReturnType<typeof vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>>;
} {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.endsWith('/api/admin/reset') && method === 'POST') {
        if (behavior === 'error') {
          return new Response(
            JSON.stringify({ error: 'reset failed', code: 'INTERNAL' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          );
        }
        const body: ResetResponse = {
          ok: true,
          reseeded: true,
          ingredients: 13,
          recipes: 4,
        };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(null, { status: 500 });
    },
  );
  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  return { fetchMock };
}

function renderSettings(): {
  queryClient: QueryClient;
  invalidateSpy: ReturnType<typeof vi.fn>;
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries') as unknown as ReturnType<
    typeof vi.fn
  >;
  render(
    <QueryClientProvider client={queryClient}>
      <Settings />
    </QueryClientProvider>,
  );
  return { queryClient, invalidateSpy };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Settings page', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('renders the page heading and the Clear all data button', () => {
    setupFetch('success');
    renderSettings();
    expect(screen.getByRole('heading', { name: 'Settings', level: 2 })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear all data' })).toBeTruthy();
  });

  it('opens the confirmation modal when Clear all data is clicked', async () => {
    setupFetch('success');
    renderSettings();
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Clear all data' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Clear all data?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Clear all data' })).toHaveLength(2);
  });

  it('closes the modal without calling fetch when Cancel is clicked', async () => {
    const { fetchMock } = setupFetch('success');
    renderSettings();
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Clear all data' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls POST /api/admin/reset on confirm and invalidates query keys on success', async () => {
    const { fetchMock } = setupFetch('success');
    const { invalidateSpy } = renderSettings();
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Clear all data' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Clear all data' })[1]!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [calledUrl, calledInit] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe('/api/admin/reset');
    expect(calledInit?.method).toBe('POST');

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ingredients'] }),
    );
    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (call) => (call[0] as { queryKey: readonly unknown[] }).queryKey[0],
    );
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining(['ingredients', 'recipes', 'plan', 'stats', 'cart', 'cart-weeks']),
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the modal open and shows the error message on failure', async () => {
    setupFetch('error');
    renderSettings();
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Clear all data' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Clear all data' })[1]!);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('reset failed');
    expect(screen.queryByRole('dialog')).not.toBeNull();
  });
});