import type { ReactNode } from 'react';

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const tone = active
    ? 'border-accent bg-accent text-white'
    : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-200';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-13 items-center justify-center rounded-full border px-4 text-base font-medium ${tone}`}
    >
      {children}
    </button>
  );
}
