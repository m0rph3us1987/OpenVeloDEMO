import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';

export function RouterErrorElement(): JSX.Element {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
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

    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Unexpected Application Error</h2>
        <p className="text-sm opacity-80">
          {error.status} {error.statusText}
        </p>
        <Link to="/" className="text-sm underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const message =
    error instanceof Error ? error.message : 'Something went wrong.';

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold">Unexpected Application Error</h2>
      <p className="text-sm opacity-80">{message}</p>
      <Link to="/" className="text-sm underline">
        Back to Dashboard
      </Link>
    </div>
  );
}
