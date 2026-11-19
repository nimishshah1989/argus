import { useId, type ReactNode } from 'react';

/** A raised panel. With a `title` the panel is a named region, so a screen reader can jump to it. */
export function Card({
  title,
  fill,
  children,
}: {
  title?: string;
  /** Fills the height of its grid cell, so cards in a row are as tall as the tallest. */
  fill?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={`flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-card ${fill ? 'h-full' : ''}`}
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
