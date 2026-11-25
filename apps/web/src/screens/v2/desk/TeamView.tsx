import type { ReactNode } from 'react';
import type { TeamModel } from './team-model.js';

export type TeamViewProps = { model: TeamModel };

/**
 * `/desk/team` under the frame's title: the takeaway, then regions Working now, Waiting, Not started, Cancelled
 * last 24 hours, Closed last 30 days (with the h3 Monthly totals per person), in v1's control order. No h1.
 */
export function TeamView(props: TeamViewProps): ReactNode {
  void props;
  throw new Error('not implemented');
}
