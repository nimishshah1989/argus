import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type ButtonProps = Omit<ComponentProps<'button'>, 'className' | 'style'> & {
  variant?: 'primary' | 'secondary' | 'tonal' | 'quiet' | 'quiet-danger';
};

/** Primary is the one filled button on a screen; tonal is a card's own action; quiet is a text-only extra. */
const VARIANT = {
  primary:
    'min-h-target bg-accent-strong text-accent-ink disabled:bg-neutral-200 disabled:text-neutral-600',
  secondary:
    'min-h-target bg-surface border border-control text-neutral-900 aria-pressed:ring-2 aria-pressed:ring-accent-strong aria-pressed:text-accent-text',
  tonal: 'min-h-target bg-accent-tint text-accent-text',
  quiet: 'min-h-target-min text-accent-text',
  'quiet-danger': 'min-h-target-min text-danger-ink',
};

const BASE = 'rounded-xl px-4 text-body font-semibold';

export function Button({ variant = 'primary', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={`${BASE} ${VARIANT[variant]}`} {...rest} />;
}

export type ButtonLinkProps = {
  variant?: ButtonProps['variant'];
  children: ReactNode;
  /** A link inside the app (client-side, no reload) or one that leaves it (a plain anchor). */
} & ({ to: string; href?: never } | { href: string; to?: never });

/**
 * A link that looks and sizes like a `Button` (a link goes somewhere, a button does something, so it is an `<a>`).
 * It keeps the 44 or 52 px target and the page's focus ring; it has no disabled state, a link that cannot be followed
 * is not drawn.
 */
export function ButtonLink({ variant = 'primary', to, href, children }: ButtonLinkProps) {
  const className = `${BASE} inline-flex items-center justify-center text-center ${VARIANT[variant]}`;
  return to !== undefined ? (
    <Link to={to} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
