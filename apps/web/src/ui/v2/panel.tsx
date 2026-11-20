import { useId, type ReactNode } from 'react';

/**
 * A titled section on the white surface. `aside` sits right of the title (a count, a filter). `inset` puts the
 * title inside the surface, for a list whose rows run edge to edge.
 */
export function Panel({
  title,
  aside,
  inset = false,
  children,
}: {
  title: string;
  aside?: ReactNode;
  inset?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const head = (
    <div className="v2-section-head">
      <h2 id={id} className="v2-h2">
        {title}
      </h2>
      {aside}
    </div>
  );
  return (
    <section aria-labelledby={id} className={inset ? 'v2-surface v2-inset' : 'v2-section'}>
      {head}
      {inset ? children : <div className="v2-surface v2-pad">{children}</div>}
    </section>
  );
}
