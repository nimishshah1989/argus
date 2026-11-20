import type { ReactNode } from 'react';

/**
 * Cards side by side on one grid: the same top edge, equal heights, 16 px apart. `wide` gives the first card the
 * larger share (a chart beside a list). Four KPI cards go `cols={4}`. Stacked on a phone.
 */
export function Row({
  cols = 2,
  wide = false,
  children,
}: {
  cols?: 2 | 3 | 4;
  wide?: boolean;
  children: ReactNode;
}) {
  return <div className={`v2-grid v2-grid-${wide ? 'wide' : cols}`}>{children}</div>;
}
