import { useTranslation } from 'react-i18next';
import type { Machine } from '../../api.js';
import { MachineRow } from '../../ui/floor-pieces.js';
import { StatusPill } from '../../ui/status/status-pill.js';
import { rowStatus } from './machines.js';
import type { FloorData } from './use-floor.js';

/** One machine with its live status; an open ticket replaces the detail line (v3.reporting.02). */
export function FloorMachineRow(p: { data: FloorData; machine: Machine; onPick: () => void }) {
  const { t } = useTranslation();
  const ticket = p.data.open.get(p.machine.id);
  const group = p.data.config.groups.find((g) => g.id === p.machine.group_id);
  const detail = ticket
    ? t(ticket.kind === 'support' ? 'reportFloor.needsSupport' : 'reportFloor.alreadyReported')
    : [group?.name ?? p.machine.category, p.machine.cell].filter(Boolean).join(' · ');
  return (
    <MachineRow
      code={p.machine.code}
      detail={detail}
      // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
      status={<StatusPill group="ticket" id={rowStatus(ticket)} />}
      onClick={p.onPick}
    />
  );
}
