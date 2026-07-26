import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '../src/components/Layout';
import { useThemeStore } from '../src/store/theme';

function renderLayout(initialPath: string): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<div>dashboard-page</div>} />
          <Route path="recipes" element={<div>recipes-page</div>} />
          <Route path="ingredients" element={<div>ingredients-page</div>} />
          <Route path="shopping-cart" element={<div>cart-page</div>} />
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
});
