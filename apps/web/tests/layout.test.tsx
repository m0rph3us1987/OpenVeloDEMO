import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout } from '../src/components/Layout';
import { RouterErrorElement } from '../src/components/RouterErrorElement';
import { useThemeStore } from '../src/store/theme';
import { NotFound } from '../src/pages/NotFound';

function renderLayout(initialPath: string): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/"
          element={<Layout />}
          errorElement={<RouterErrorElement />}
        >
          <Route index element={<div>dashboard-page</div>} />
          <Route path="recipes" element={<div>recipes-page</div>} />
          <Route path="ingredients" element={<div>ingredients-page</div>} />
          <Route path="shopping-cart" element={<div>cart-page</div>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Layout sidebar', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light' });
  });

  it('renders all four nav entries inside the sidebar', () => {
    renderLayout('/');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Recipes' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ingredients' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Shopping Cart' })).toBeTruthy();
  });

  it('marks the active route with accent styles', () => {
    renderLayout('/recipes');
    const recipes = screen.getByRole('link', { name: 'Recipes' });
    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    expect(recipes.className).toContain('bg-accent');
    expect(recipes.className).toContain('text-background');
    expect(dashboard.className).not.toContain('bg-accent');
  });

  it('applies focus-visible ring classes to nav links and the toggle button', () => {
    renderLayout('/');
    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboard.className).toContain('focus-visible:ring-2');
    expect(dashboard.className).toContain('focus-visible:ring-ring');
    const toggle = screen.getByRole('button', { name: 'Toggle theme' });
    expect(toggle.className).toContain('focus-visible:ring-2');
    expect(toggle.className).toContain('focus-visible:ring-ring');
  });

  it('keeps the sidebar visible and renders NotFound for unknown routes', () => {
    renderLayout('/unknown-route');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Recipes' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ingredients' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Shopping Cart' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });

  it('keeps the sidebar visible and renders NotFound for nested unmatched paths like /recipes/new', () => {
    renderLayout('/recipes/new');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Recipes' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ingredients' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Shopping Cart' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });
});

function HistoryDriver(): JSX.Element {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>
        back
      </button>
      <button type="button" onClick={() => navigate(1)}>
        forward
      </button>
    </>
  );
}

function renderWithHistory(
  entries: string[],
  initialIndex: number,
): { back: () => void; forward: () => void } {
  function Harness(): JSX.Element {
    const [, setTick] = useState(0);
    return (
      <>
        <button type="button" onClick={() => setTick((t) => t + 1)}>
          force
        </button>
        <Routes>
          <Route
            path="/"
            element={<Layout />}
            errorElement={<RouterErrorElement />}
          >
            <Route index element={<div>dashboard-page</div>} />
            <Route path="recipes" element={<div>recipes-page</div>} />
            <Route path="ingredients" element={<div>ingredients-page</div>} />
            <Route path="shopping-cart" element={<div>cart-page</div>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        <HistoryDriver />
      </>
    );
  }

  render(
    <MemoryRouter initialEntries={entries} initialIndex={initialIndex}>
      <Harness />
    </MemoryRouter>,
  );
  return {
    back: () => fireEvent.click(screen.getByText('back')),
    forward: () => fireEvent.click(screen.getByText('forward')),
  };
}

describe('Layout sidebar back/forward highlight', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light' });
  });

  it('highlights the link matching the location after navigating back', () => {
    const { back } = renderWithHistory(
      ['/', '/recipes', '/shopping-cart'],
      2,
    );
    back();
    const recipes = screen.getByRole('link', { name: 'Recipes' });
    const cart = screen.getByRole('link', { name: 'Shopping Cart' });
    expect(recipes.className).toContain('bg-accent');
    expect(cart.className).not.toContain('bg-accent');
  });

  it('highlights Dashboard when navigating back to /', () => {
    const { back } = renderWithHistory(['/', '/recipes'], 1);
    back();
    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    const recipes = screen.getByRole('link', { name: 'Recipes' });
    expect(dashboard.className).toContain('bg-accent');
    expect(recipes.className).not.toContain('bg-accent');
  });

  it('highlights the correct link after navigating forward', () => {
    const { forward } = renderWithHistory(['/', '/recipes'], 0);
    forward();
    const recipes = screen.getByRole('link', { name: 'Recipes' });
    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    expect(recipes.className).toContain('bg-accent');
    expect(dashboard.className).not.toContain('bg-accent');
  });
});
