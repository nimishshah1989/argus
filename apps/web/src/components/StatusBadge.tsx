/* eslint-disable i18next/no-literal-string -- StatusPill ids, not copy */
import type { RaiseKind, TicketStatus } from '../api.js';
import { StatusPill } from '../ui/status/status-pill.js';

/** The state chip: colour, icon and word together. An unstarted ticket is "Booked", a handed-over one "Transferred". */
export function StatusBadge({
  status,
  handedOver = false,
}: {
  status: TicketStatus;
  handedOver?: boolean;
}) {
  if (status === 'open') {
    return handedOver ? (
      <StatusPill group="ticket" id="transferred" />
    ) : (
      <StatusPill group="floor" id="booked" />
    );
  }
  if (status === 'working') return <StatusPill group="ticket" id="in_progress" />;
  if (status === 'waiting') return <StatusPill group="ticket" id="waiting" />;
  if (status === 'closed') return <StatusPill group="ticket" id="closed" />;
  return <StatusPill group="ticket" id="cancelled" />;
}

/** Whether a closed ticket has its breakdown report, or still needs it. */
export function ReportBadge({ state }: { state: 'with' | 'needs' }) {
  return state === 'with' ? (
    <StatusPill group="report" id="with_report" />
  ) : (
    <StatusPill group="report" id="needs_report" />
  );
}

/** The kind chip: a stopped machine or a support request; a work request has none. */
export function KindBadge({ kind }: { kind: RaiseKind }) {
  if (kind === 'stopped') return <StatusPill group="ticket" id="stopped" />;
  if (kind === 'support') return <StatusPill group="ticket" id="support" />;
  return null;
}
