import type { ReactNode } from 'react';
import type { CommandAction, Ticket } from '../../../api.js';
import type { MineModel } from './team-model.js';

export type MineViewProps = {
  model: MineModel;
  /** A quick command is sending: the quick buttons are disabled. */
  pending: boolean;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
  /** The "Day report" link was pressed (the Page downloads it with the sign-in token). */
  onDayReport: () => void;
  /** The last download failed: "Could not download the day report." under the link. */
  dayReportFailed: boolean;
};

/**
 * `/desk/mine` under the frame's title: regions In progress and Waiting (ticket cards with their quick button),
 * Closed last 30 days (rows), and the "Day report" link last, in v1's control order. No h1.
 */
export function MineView(props: MineViewProps): ReactNode {
  void props;
  throw new Error('not implemented');
}
