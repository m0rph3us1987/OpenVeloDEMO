import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { RouterErrorElement } from '@/components/RouterErrorElement';
import { ShoppingCart } from '@/pages/ShoppingCart';
import { Dashboard } from '@/pages/Dashboard';
import { Recipes } from '@/pages/Recipes';
import { Ingredients } from '@/pages/Ingredients';
import { NotFound } from '@/pages/NotFound';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouterErrorElement />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'recipes', element: <Recipes /> },
      { path: 'ingredients', element: <Ingredients /> },
      { path: 'shopping-cart', element: <ShoppingCart /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App(): JSX.Element {
  return <RouterProvider router={router} />;
}
