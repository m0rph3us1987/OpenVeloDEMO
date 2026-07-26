import { describe, it, expect, beforeEach, vi } from 'vitest';

function setupMatchMedia(matchesDark: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matchesDark && query.includes('dark'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

import { initialTheme, useThemeStore } from '../src/store/theme';

function resetDom(): void {
  document.documentElement.className = '';
}

describe('theme store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDom();
    useThemeStore.setState({ theme: 'light' });
  });

  it('falls back to system preference when no stored theme', () => {
    setupMatchMedia(true);
    useThemeStore.getState().init();
    expect(initialTheme()).toBe('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggle persists to localStorage and updates <html> class', () => {
    setupMatchMedia(false);
    useThemeStore.setState({ theme: 'light' });
    useThemeStore.getState().toggle();
    const stored = window.localStorage.getItem('theme');
    expect(stored === 'dark' || stored === 'light').toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(stored === 'dark');
  });
});