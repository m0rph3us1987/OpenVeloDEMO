import { useEffect, useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

export type ResetResponse = {
  ok: true;
  reseeded: true;
  ingredients: number;
  recipes: number;
};

async function resetApi(): Promise<ResetResponse> {
  const res = await fetch('/api/admin/reset', { method: 'POST' });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // ignore parse errors and use fallback
    }
    throw new Error(message);
  }
  return res.json();
}

const INVALIDATION_KEYS = [
  'ingredients',
  'recipes',
  'plan',
  'stats',
  'cart',
  'cart-weeks',
] as const;

function ConfirmModal(props: {
  pending: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element {
  const { pending, errorMessage, onConfirm, onCancel } = props;
  const titleId = useId();
  const errorId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !pending) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, pending]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-md border border-muted bg-background p-4 shadow-lg">
        <h3 id={titleId} className="text-base font-semibold">
          Clear all data?
        </h3>
        <p className="mt-1 text-sm opacity-80">
          This will erase all recipes, ingredients, planned meals, cook history,
          and shopping cart, and re-seed the demo data.
        </p>
        {errorMessage && (
          <p
            id={errorId}
            role="alert"
            aria-live="polite"
            className="mt-2 text-sm text-red-600 dark:text-red-400"
          >
            {errorMessage}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            aria-label="Clear all data"
          >
            {pending ? 'Clearing…' : 'Clear all data'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Settings(): JSX.Element {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successId = useId();

  const reset = useMutation({
    mutationFn: resetApi,
    onSuccess: () => {
      for (const key of INVALIDATION_KEYS) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      setSuccessMessage('All data cleared and reseeded with the demo set.');
      setResetError(null);
      setModalOpen(false);
    },
    onError: (err: Error) => setResetError(err.message),
  });

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const openModal = (): void => {
    setResetError(null);
    setModalOpen(true);
  };
  const cancelModal = (): void => {
    if (reset.isPending) return;
    setResetError(null);
    setModalOpen(false);
  };

  return (
    <section aria-labelledby="settings-heading" className="space-y-6 max-w-2xl">
      <header>
        <h2 id="settings-heading" className="text-2xl font-semibold">
          Settings
        </h2>
        <p className="mt-1 text-sm opacity-80">
          Application information and data management.
        </p>
      </header>

      <div className="rounded-md border border-muted p-4 space-y-1">
        <h3 className="text-sm font-semibold">About OpenVelo</h3>
        <p className="text-sm opacity-80">
          OpenVelo is a meal-planning workspace for tracking recipes,
          ingredients, weekly plans, cook history, and a derived shopping cart.
        </p>
        <p className="text-xs opacity-60">Version 0.1.0</p>
      </div>

      <div className="rounded-md border border-muted p-4 space-y-2">
        <h3 className="text-sm font-semibold">Data</h3>
        <p className="text-sm opacity-80">
          Reset the workspace to its original demo state. This permanently
          removes every recipe, ingredient, planned meal, cook log, and cart
          entry, and re-seeds the sample data.
        </p>
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={openModal}
            aria-haspopup="dialog"
          >
            Clear all data
          </Button>
        </div>
        {successMessage && (
          <p
            id={successId}
            role="status"
            aria-live="polite"
            className="text-sm text-green-700 dark:text-green-400"
          >
            {successMessage}
          </p>
        )}
      </div>

      {modalOpen && (
        <ConfirmModal
          pending={reset.isPending}
          errorMessage={resetError}
          onConfirm={() => reset.mutate()}
          onCancel={cancelModal}
        />
      )}
    </section>
  );
}