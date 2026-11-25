import type { ReactNode } from 'react';
import type { CommandAction, Ticket } from '../../../api.js';
import type { ChipFilter } from '../../desk/openLists.js';
import type { OpenModel, Segment } from './model.js';

export type OpenViewProps = {
  model: OpenModel;
  /** A quick button is disabled while a command sends. */
  pending: boolean;
  onFilter: (filter: ChipFilter) => void;
  onSegment: (segment: Segment) => void;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
  /** The sign-off feed (`components/SignoffFeed.tsx`), drawn under the counts; the Page passes it. */
  signoff?: ReactNode;
  /**
   * Wide (>= 1024 px) only: the right-hand region "Ticket". `undefined` on a phone (no pane); `null` when no ticket
   * is chosen (the "Pick a ticket" line); otherwise the embedded ticket.
   */
  pane?: ReactNode | null;
};

/**
 * The Open screen's body, in v1's control order (`e2e/gallery/desk-order.spec.ts` OPEN): counts, filter line,
 * sign-off feed, Team now link, segments, the chosen list (with its takeaway), then Closed without a report.
 */
export function OpenView(props: OpenViewProps): ReactNode {
  void props;
  throw new Error('not implemented');
}
