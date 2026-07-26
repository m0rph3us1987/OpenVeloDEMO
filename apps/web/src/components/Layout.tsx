import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useThemeStore } from '@/store/theme';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/recipes', label: 'Recipes' },
  { to: '/ingredients', label: 'Ingredients' },
  { to: '/shopping-cart', label: 'Shopping Cart' },
];

export function Layout(): JSX.Element {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);

  return (
    <div className="flex h-full">
      <aside className="w-60 border-r border-muted p-4 flex flex-col gap-2">
        <h1 className="text-xl font-bold mb-4">OpenVelo</h1>
        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'px-3 py-2 rounded-md text-sm',
                  isActive
                    ? 'bg-accent text-background'
                    : 'hover:bg-muted',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Button variant="outline" onClick={toggle} aria-label="Toggle theme">
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </Button>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}