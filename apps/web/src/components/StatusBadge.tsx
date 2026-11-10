import type { TicketStatus } from '../api.js';

const TONES: Record<TicketStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-neutral-200 text-neutral-700' },
  working: { label: 'In progress', className: 'bg-in-progress/10 text-in-progress' },
  waiting: { label: 'Waiting', className: 'bg-waiting/10 text-waiting' },
  closed: { label: 'Closed', className: 'bg-running/10 text-running' },
  cancelled: { label: 'Cancelled', className: 'bg-neutral-200 text-neutral-500' },
};

/** Colour never carries meaning alone: the status label is always with the dot. */
export function StatusBadge({ status }: { status: TicketStatus }) {
  const tone = TONES[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone.className}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {tone.label}
    </span>
  );
}
