import { Link, Outlet, matchPath, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useThemeStore } from '@/store/theme';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/recipes', label: 'Recipes', end: false },
  { to: '/ingredients', label: 'Ingredients', end: false },
  { to: '/shopping-cart', label: 'Shopping Cart', end: false },
];

export function Layout(): JSX.Element {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const location = useLocation();

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-56 md:w-60 lg:w-64 shrink-0 border-r border-muted p-4 flex flex-col gap-2 h-full overflow-y-auto">
        <h1 className="text-xl font-bold mb-4">OpenVelo</h1>
        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              matchPath({ path: item.to, end: item.end }, location.pathname) !== null;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'px-3 py-2 rounded-md text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  isActive ? 'bg-accent text-background' : 'hover:bg-muted',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Button variant="outline" onClick={toggle} aria-label="Toggle theme">
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </Button>
      </aside>
      <main className="flex-1 min-w-0 p-4 md:p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}