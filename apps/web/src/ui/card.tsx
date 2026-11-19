import { useId, type ReactNode } from 'react';

/** A raised panel. With a `title` the panel is a named region, so a screen reader can jump to it. */
export function Card({ title, children }: { title?: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className="flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-card"
    >
      {title ? (
        <h3 id={headingId} className="text-title3 font-semibold">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}
