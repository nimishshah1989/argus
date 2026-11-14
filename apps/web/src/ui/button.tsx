import type { ComponentProps } from 'react';

export type ButtonProps = Omit<ComponentProps<'button'>, 'className' | 'style'> & {
  variant?: 'primary' | 'secondary' | 'tonal' | 'quiet' | 'quiet-danger';
};

/** Primary is the one filled button on a screen; tonal is a card's own action; quiet is a text-only extra. */
const VARIANT = {
  // Disabled is greyed (T2, A1-5): one primary action must not look live until it is.
  primary:
    'min-h-target bg-accent-strong text-accent-ink disabled:bg-neutral-200 disabled:text-neutral-600',
  secondary:
    'min-h-target bg-surface border border-control text-neutral-900 aria-pressed:ring-2 aria-pressed:ring-accent-strong aria-pressed:text-accent-text',
  tonal: 'min-h-target bg-accent-tint text-accent-text',
  quiet: 'min-h-target-min text-accent-text',
  'quiet-danger': 'min-h-target-min text-danger-ink',
};

export function Button({ variant = 'primary', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`rounded-xl px-4 text-body font-semibold ${VARIANT[variant]}`}
      {...rest}
    />
  );
}
