import { useId, type ReactNode } from 'react';

/** A raised panel. With `named` its title also names it as a region, so a screen reader can jump to it. */
export function Card({
  title,
  fill,
  named,
  children,
}: {
  title?: string;
  /** Fills the height of its grid cell, so cards in a row are as tall as the tallest. */
  fill?: boolean;
  /** The title names the panel as a region (a landmark); leave it off for a card among many. */
  named?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={title && named ? headingId : undefined}
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
