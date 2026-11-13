import type { ComponentProps } from 'react';

type Bare<T extends 'input' | 'label'> = Omit<ComponentProps<T>, 'className' | 'style'>;

export function Input(props: Bare<'input'>) {
  return (
    <input
      className="min-h-target w-full rounded-lg border border-neutral-300 bg-surface px-3 text-body"
      {...props}
    />
  );
}

export function Label(props: Bare<'label'>) {
  return <label className="text-footnote font-medium text-neutral-700" {...props} />;
}
