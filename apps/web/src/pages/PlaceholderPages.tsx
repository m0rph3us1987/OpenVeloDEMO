import { Link } from 'react-router-dom';

export function Dashboard(): JSX.Element {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Dashboard</h2>
      <p className="text-sm opacity-80">
        Welcome to OpenVelo. Use the sidebar to navigate.
      </p>
      <ul className="mt-4 text-sm list-disc pl-5">
        <li><Link to="/recipes" className="underline">Recipes</Link></li>
        <li><Link to="/ingredients" className="underline">Ingredients</Link></li>
        <li><Link to="/shopping-cart" className="underline">Shopping Cart</Link></li>
      </ul>
    </div>
  );
}