import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import {
  Dashboard,
  Recipes,
  Ingredients,
  ShoppingCart,
} from '@/pages/PlaceholderPages';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'recipes', element: <Recipes /> },
      { path: 'ingredients', element: <Ingredients /> },
      { path: 'shopping-cart', element: <ShoppingCart /> },
    ],
  },
]);

export function App(): JSX.Element {
  return <RouterProvider router={router} />;
}