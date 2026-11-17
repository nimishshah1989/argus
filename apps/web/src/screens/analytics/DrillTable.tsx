import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DrillType } from '@uptimo/shared/analytics';
import type { MachineRow, MoveRow, TicketRow } from '@uptimo/domain';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { Config } from '../../api.js';
import { getConfig, getDrill } from '../../api.js';
import type { AnalyticsGroup } from './groups.js';

type Drill = { type: DrillType; ids: string[] };
type Row = MachineRow | MoveRow | TicketRow;

const HEAD: Record<DrillType, MessageKey[]> = {
  machine: ['analytics.drill.code', 'analytics.drill.cell'],
  ticket: ['analytics.drill.ref', 'analytics.drill.machine', 'analytics.drill.status'],
  move: ['analytics.drill.from', 'analytics.drill.to', 'analytics.drill.date'],
};

const STATUS: Record<TicketRow['status'], MessageKey> = {
  open: 'analytics.status.open',
  working: 'analytics.status.working',
  waiting: 'analytics.status.waiting',
  closed: 'analytics.status.closed',
  cancelled: 'analytics.status.cancelled',
};

const NONE: MessageKey = 'analytics.value.none';

/** The identifying fields of one drilled row, in the same order as the headers. */
function cellsOf(
  type: DrillType,
  row: Row,
  machines: Config['machines'] | undefined,
  t: (key: MessageKey) => string,
): string[] {
  if (type === 'machine') {
    const machine = row as MachineRow;
    return [machine.code, machine.cell ?? t(NONE)];
  }
  if (type === 'ticket') {
    const ticket = row as TicketRow;
    const code = machines?.find((machine) => machine.id === ticket.machineId)?.code;
    return [ticket.ref, code ?? ticket.machineId ?? t(NONE), t(STATUS[ticket.status])];
  }
  const move = row as MoveRow;
  return [move.fromCell ?? t(NONE), move.toCell ?? t(NONE), move.effectiveFrom];
}

/** The rows a figure drilled to: a plain table of what identifies each one. */
export function DrillTable({ group, drill }: { group: AnalyticsGroup; drill: Drill }) {
  const { t } = useTranslation();
  const reply = useQuery({
    queryKey: ['analytics-drill', drill.type, drill.ids],
    queryFn: () => getDrill(drill.type, drill.ids),
  });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const head = HEAD[drill.type];
  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title3 font-semibold">{t('analytics.drill.title')}</h2>
        <Link
          to={`/analytics/${group.id}`}
          className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
        >
          {t('analytics.drill.back')}
        </Link>
      </div>
      {reply.isLoading ? (
        <p role="status" className="text-body text-neutral-600">
          {t('common.loading')}
        </p>
      ) : reply.error ? (
        <p role="alert" className="text-body font-medium text-neutral-900">
          {t('kit.pattern.error')}
        </p>
      ) : !reply.data || reply.data.rows.length === 0 ? (
        <p className="text-body text-neutral-600">{t('analytics.drill.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-footnote">
            <thead>
              <tr>
                {head.map((key) => (
                  <th key={key} scope="col" className="p-2 font-medium text-neutral-600">
                    {t(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reply.data.rows.map((row) => (
                <tr key={row.id} className="border-t border-neutral-200">
                  {cellsOf(drill.type, row, config.data?.machines, t).map((cell, index) => (
                    <td key={head[index]} className="p-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
