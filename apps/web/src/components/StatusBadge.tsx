import { useTranslation } from 'react-i18next';
import type { TicketStatus } from '../api.js';

const TONES: Record<TicketStatus, { key: string; className: string }> = {
  open: { key: 'status.open', className: 'bg-neutral-200 text-neutral-700' },
  working: { key: 'status.working', className: 'bg-in-progress/10 text-in-progress' },
  waiting: { key: 'status.waiting', className: 'bg-waiting/10 text-waiting' },
  closed: { key: 'status.closed', className: 'bg-running/10 text-running' },
  cancelled: { key: 'status.cancelled', className: 'bg-neutral-200 text-neutral-500' },
};

/** Colour never carries meaning alone: the status label is always with the dot. */
export function StatusBadge({ status }: { status: TicketStatus }) {
  const { t } = useTranslation();
  const tone = TONES[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone.className}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(tone.key)}
    </span>
  );
}
