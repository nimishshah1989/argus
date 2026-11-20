import type { ReactNode } from 'react';

/** A v2 button, 44 px tall, pressing to 0.97. `primary` is the one accent action of its card; the rest are quiet. */
export function Button({
  primary = false,
  onClick,
  children,
}: {
  primary?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={primary ? 'v2-btn v2-btn-primary' : 'v2-btn v2-btn-ghost'}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
