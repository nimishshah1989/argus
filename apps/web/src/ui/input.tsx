import type { ComponentProps } from 'react';

type Bare<T extends 'input' | 'label' | 'textarea' | 'select'> = Omit<
  ComponentProps<T>,
  'className' | 'style'
>;
const FIELD =
  'rounded-lg border border-control bg-surface px-3 text-body [&[readonly]]:bg-neutral-200';
const FULL = 'w-full';
const FIT = 'w-auto';

export function Input(props: Bare<'input'>) {
  return <input className={`min-h-target ${FULL} ${FIELD}`} {...props} />;
}

export function Textarea(props: Bare<'textarea'>) {
  return <textarea rows={3} className={`py-3 ${FULL} ${FIELD}`} {...props} />;
}

/** Full width by default; `fit` sizes it to its longest option (a period or sort choice beside other controls). */
export function Select({ fit, ...rest }: Bare<'select'> & { fit?: boolean }) {
  return <select className={`min-h-target ${fit ? FIT : FULL} ${FIELD}`} {...rest} />;
}

export function Label(props: Bare<'label'>) {
  return <label className="text-footnote font-medium text-neutral-700" {...props} />;
}

/** A tick box as a full-width bordered row: the whole row is the tap target. */
export function Checkbox({ label, ...rest }: Omit<Bare<'input'>, 'type'> & { label: string }) {
  return (
    <label className={`flex min-h-target items-center gap-3 ${FULL} ${FIELD}`}>
      <input type="checkbox" className="size-5 accent-accent-strong" {...rest} />
      <span>{label}</span>
    </label>
  );
}
