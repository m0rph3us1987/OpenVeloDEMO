import type { IngredientCategory } from '@openvelo/types';

export type CartLineSource = 'plan' | 'manual';

export type CartItem = {
  ingredientId: string;
  name: string;
  category: IngredientCategory;
  autoQuantity: number;
  manualQuantity: number;
  totalQuantity: number;
  unit: 'g' | 'ml' | 'pcs';
  source: CartLineSource[];
  manualLineId: string | null;
};

export type CartGroup = {
  category: IngredientCategory;
  items: CartItem[];
};

export type CartResponse = {
  weekKey: string;
  weekLabel: string;
  dateRange: { start: string; end: string };
  groups: CartGroup[];
};

export type CartWeekSummary = {
  weekKey: string;
  weekLabel: string;
  dateRange: { start: string; end: string };
  itemCount: number;
};

export type CartLineRecord = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  category: IngredientCategory;
  quantity: number;
  unit: 'g' | 'ml' | 'pcs';
  note: string | null;
  source: 'auto' | 'manual';
  week: string;
};

export type DisplayUnit = 'g' | 'kg' | 'ml' | 'l' | 'pcs';

export const DISPLAY_UNITS: readonly DisplayUnit[] = [
  'g',
  'kg',
  'ml',
  'l',
  'pcs',
];

export type CartLineInput = {
  ingredientId: string;
  quantity: number;
  unit: DisplayUnit;
  note?: string;
};

export type CartLinePatch = {
  quantity?: number;
  unit?: DisplayUnit;
  note?: string | null;
};

export type FormattedQuantity = {
  value: number;
  unit: DisplayUnit;
  formatted: string;
};

export function formatDisplayQuantity(
  qty: number,
  baseUnit: 'g' | 'ml' | 'pcs',
): FormattedQuantity {
  if (baseUnit === 'g') {
    if (qty >= 1000) {
      const value = qty / 1000;
      return { value, unit: 'kg', formatted: `${value.toFixed(2)} kg` };
    }
    return { value: qty, unit: 'g', formatted: `${qty.toFixed(2)} g` };
  }
  if (baseUnit === 'ml') {
    if (qty >= 1000) {
      const value = qty / 1000;
      return { value, unit: 'l', formatted: `${value.toFixed(2)} l` };
    }
    return { value: qty, unit: 'ml', formatted: `${qty.toFixed(2)} ml` };
  }
  return { value: qty, unit: 'pcs', formatted: `${qty.toFixed(0)} pcs` };
}

async function parseError(res: Response): Promise<string> {
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

function api<T>(url: string, init?: RequestInit): Promise<T> {
  return fetch(url, init).then(async (res) => {
    if (!res.ok) {
      throw new Error(await parseError(res));
    }
    if (res.status === 204) {
      return undefined as T;
    }
    return res.json() as Promise<T>;
  });
}

export function fetchCurrentCart(): Promise<CartResponse> {
  return api<CartResponse>('/api/cart');
}

export function fetchWeekCart(weekKey: string): Promise<CartResponse> {
  return api<CartResponse>(`/api/cart/weeks/${encodeURIComponent(weekKey)}`);
}

export function fetchCartWeeks(): Promise<CartWeekSummary[]> {
  return api<CartWeekSummary[]>('/api/cart/weeks');
}

export function createCartLine(input: CartLineInput): Promise<CartLineRecord> {
  return api<CartLineRecord>('/api/cart/lines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateCartLine(
  id: string,
  input: CartLinePatch,
): Promise<CartLineRecord> {
  return api<CartLineRecord>(`/api/cart/lines/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deleteCartLine(id: string): Promise<void> {
  return api<void>(`/api/cart/lines/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}