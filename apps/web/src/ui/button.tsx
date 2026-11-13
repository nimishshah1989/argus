import type { ComponentProps } from 'react';

export type ButtonProps = Omit<ComponentProps<'button'>, 'className' | 'style'> & {
  variant?: 'primary' | 'secondary';
};

const VARIANT = {
  primary: 'bg-accent-strong text-white',
  secondary: 'bg-surface border border-neutral-300 text-neutral-900',
};

export function Button({ variant = 'primary', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`min-h-target rounded-xl px-4 text-body font-semibold ${VARIANT[variant]}`}
      {...rest}
    />
  );
}
