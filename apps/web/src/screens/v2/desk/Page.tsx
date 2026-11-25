import type { ReactNode } from 'react';

/**
 * `/desk` and `/desk/:id` (the live wiring): reads `/state`, `/config`, `/auth/me`, holds the filter and segment,
 * runs quick commands through `useCommand`, refuses a role `mayOpen` refuses, and from 1024 px draws the chosen
 * ticket (v1 `TicketDetail embedded`, until S29) beside the list.
 */
export function DeskOpenPage(): ReactNode {
  throw new Error('not implemented');
}
