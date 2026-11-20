import { useId, type ReactNode } from 'react';

/**
 * A titled card: white, a hairline edge, a soft resting shadow, its title row inside. `aside` sits right of the title
 * (a count, a filter); `sub` is one quiet line under it. `flush` lets the rows run to the card's edges.
 */
export function Panel({
  title,
  sub,
  aside,
  flush = false,
  children,
}: {
  title: string;
  sub?: string;
  aside?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={flush ? 'v2-card v2-flush' : 'v2-card v2-pad'}>
      <div className="v2-card-head">
        <div>
          <h2 id={id} className="v2-h2">
            {title}
          </h2>
          {sub ? <p className="v2-sub">{sub}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
