import type { ReactNode } from 'react';

/** A v2 button, 44 px tall, pressing to 0.97. `primary` is the one accent action of its card; the rest are quiet. */
export function Button({
  primary = false,
  danger = false,
  disabled = false,
  onClick,
  children,
}: {
  primary?: boolean;
  /** A quiet button that ends or removes something (Cancel ticket, Sign out): its words in the loss colour. */
  danger?: boolean;
  /** A press does nothing and the button says so (the move in flight). */
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={
        primary ? 'v2-btn v2-btn-primary' : danger ? 'v2-btn v2-btn-danger' : 'v2-btn v2-btn-ghost'
      }
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** The quiet button that goes to another page: the same look as `Button`, a real link underneath. */
export function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="v2-btn v2-btn-ghost" href={href}>
      {children}
    </a>
  );
}
