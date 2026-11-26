import { useTranslation } from 'react-i18next';
import type { TicketStatus } from '../../../../api.js';
import type { IconName } from '../../../../ui/v2/icons.js';
import { KeyPill, type PillTone } from '../../../../ui/v2/key-pill.js';

const BADGE: Record<string, { label: string; tone: PillTone; icon: IconName }> = {
  booked: { label: 'status.floor.booked', tone: 'risk', icon: 'clock' },
  transferred: { label: 'status.ticket.transferred', tone: 'decide', icon: 'chevronRight' },
  working: { label: 'status.ticket.inProgress', tone: 'plan', icon: 'wrench' },
  waiting: { label: 'status.ticket.waiting', tone: 'risk', icon: 'pause' },
  closed: { label: 'status.ticket.closed', tone: 'neutral', icon: 'check' },
  cancelled: { label: 'status.ticket.cancelled', tone: 'neutral', icon: 'stop' },
};

/** The state chip: icon and word together. An unstarted ticket is "Booked", a handed-over one "Transferred". */
export function StatusBadge({
  status,
  handedOver = false,
}: {
  status: TicketStatus;
  handedOver?: boolean;
}) {
  const { t } = useTranslation();
  const key =
    status === 'open'
      ? handedOver
        ? 'transferred'
        : 'booked'
      : status in BADGE
        ? status
        : 'cancelled';
  const badge = BADGE[key]!;
  return <KeyPill text={t(badge.label)} tone={badge.tone} icon={badge.icon} />;
}
