import type { ComponentProps } from 'react';

type Bare<T extends 'input' | 'label' | 'textarea' | 'select'> = Omit<
  ComponentProps<T>,
  'className' | 'style'
>;
const FIELD = 'w-full rounded-lg border border-control bg-surface px-3 text-body';

export function Input(props: Bare<'input'>) {
  return <input className={`min-h-target ${FIELD}`} {...props} />;
}

export function Textarea(props: Bare<'textarea'>) {
  return <textarea rows={3} className={`py-3 ${FIELD}`} {...props} />;
}

export function Select(props: Bare<'select'>) {
  return <select className={`min-h-target ${FIELD}`} {...props} />;
}

export function Label(props: Bare<'label'>) {
  return <label className="text-footnote font-medium text-neutral-700" {...props} />;
}

/** A tick box as a full-width bordered row: the whole row is the tap target. */
export function Checkbox({ label, ...rest }: Omit<Bare<'input'>, 'type'> & { label: string }) {
  return (
    <label className={`flex min-h-target items-center gap-3 ${FIELD}`}>
      <input type="checkbox" className="size-5 accent-accent-strong" {...rest} />
      <span>{label}</span>
    </label>
  );
}
