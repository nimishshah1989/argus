import type { ReactNode } from 'react';
import { DISPLAY_STYLE } from './direction-props.js';

/** One titled block of a screen; its heading wears the direction's display type like the figures do. */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-body font-semibold" style={DISPLAY_STYLE}>
        {title}
      </h3>
      {children}
    </section>
  );
}
