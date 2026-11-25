import type { ReactNode } from 'react';
import type { CommandAction, CommandBody, Config, Me, TicketDetail } from '../../../api.js';
import type { TicketModel } from './model.js';

export type TicketViewProps = {
  model: TicketModel;
  /** The reply, config and login the re-hosted v1 parts take (TaskPanel, SignoffPanel, SlaTimerSummary, LockoutGate/Card, PmReport, AdminPanel, ReportControls). */
  detail: TicketDetail;
  config?: Config;
  me?: Me;
  run: (ticketId: string, action: CommandAction, body: CommandBody) => Promise<boolean>;
  pending: boolean;
  error: string | null;
  /** Opens the full-screen close flow: Write report and close ('close') or Fill report ('late'). */
  onFlow: (mode: 'close' | 'late') => void;
};

/**
 * Draws the ticket in v1's control order (gallery/desk-order.spec.ts): header (h1 with the ref), panels, SLA timers,
 * acknowledged line, facts, lockout card, report card, Send on WhatsApp, Minutes, Who worked on it, Full history,
 * Admin, then the v1 action bar. Takeaways are plain text lines, never headings, links or buttons.
 */
export function TicketView(props: TicketViewProps): ReactNode {
  void props;
  throw new Error('not implemented');
}
