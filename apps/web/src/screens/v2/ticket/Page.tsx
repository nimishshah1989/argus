import type { ReactNode } from 'react';

/**
 * `/desk/:id` (the live wiring, replaces v1 `TicketDetail`): reads `['ticket', id]`, `['config']`, `['me']` and the
 * brand, runs commands through `useCommand`, opens `CloseFlow` full screen, and shows loading, error (with Try again)
 * and not-found. `embedded`: inside the desk's pane, whose frame already shows the sync pill and offline banner.
 */
export function TicketPage({ embedded = false }: { embedded?: boolean }): ReactNode {
  void embedded;
  throw new Error('not implemented');
}
