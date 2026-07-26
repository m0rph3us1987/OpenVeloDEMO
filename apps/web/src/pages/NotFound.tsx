import { Link } from 'react-router-dom';

export function NotFound(): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold">Page not found</h2>
      <p className="text-sm opacity-80">
        The page you are looking for does not exist.
      </p>
      <Link to="/" className="text-sm underline">
        Back to Dashboard
      </Link>
    </div>
  );
}
