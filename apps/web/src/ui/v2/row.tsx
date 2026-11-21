import type { ReactNode } from 'react';

/**
 * Cards side by side on one grid: the same top edge, equal heights, 16 px apart. `wide` gives the first card the
 * larger share (a chart beside a list). Four KPI cards go `cols={4}`. Stacked on a phone.
 */
export function Row({
  cols = 2,
  wide = false,
  hero = false,
  children,
}: {
  cols?: 2 | 3 | 4;
  wide?: boolean;
  /** The first card is the lead figure (`hero` on its KPI): twice the width and height, the rest beside it. */
  hero?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`v2-grid v2-grid-${hero ? 'hero' : wide ? 'wide' : cols}`}>{children}</div>
  );
}
