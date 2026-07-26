import { useEffect, useId, useRef, useState } from 'react';
import type { BaseUnit } from '@openvelo/types';
import { cn } from '@/lib/utils';

export type IngredientOption = {
  id: string;
  name: string;
  baseUnit: BaseUnit;
};

export type IngredientPickerProps = {
  value: { id: string | null; name: string };
  options: IngredientOption[];
  onSelect: (ingredient: IngredientOption) => void;
  onQueryChange: (name: string) => void;
  error?: string;
  ariaLabel?: string;
};

export function IngredientPicker(props: IngredientPickerProps): JSX.Element {
  const { value, options, onSelect, onQueryChange, error, ariaLabel } = props;
  const listboxId = useId();
  const inputId = useId();
  const errorId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const query = value.name.trim().toLowerCase();
  const matches = options.filter((o) => o.name.toLowerCase().includes(query));
  const showSelected = value.id !== null;
  const visibleOptions = showSelected ? options : matches;

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent): void {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, visibleOptions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      if (open && activeIndex >= 0 && activeIndex < visibleOptions.length) {
        event.preventDefault();
        const choice = visibleOptions[activeIndex];
        if (choice) {
          onSelect(choice);
          setOpen(false);
        }
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-label={ariaLabel ?? 'Ingredient'}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        value={value.name}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full rounded-md border bg-background px-3 py-2 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          error ? 'border-red-500' : 'border-muted',
        )}
      />
      {open && visibleOptions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-muted bg-background shadow"
        >
          {visibleOptions.map((option, index) => (
            <li
              key={option.id}
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                'cursor-pointer px-3 py-2 text-sm',
                index === activeIndex ? 'bg-muted' : 'hover:bg-muted',
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(option);
                setOpen(false);
              }}
            >
              {option.name}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
