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

/** The table body: one row per drilled row, a machine code opening that machine's page. */
function DrillRows({
  type,
  rows,
  machines,
}: {
  type: DrillType;
  rows: readonly Row[];
  machines: Config['machines'] | undefined;
}) {
  const { t } = useTranslation();
  const head = HEAD[type];
  return (
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
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-neutral-200">
              {cellsOf(type, row, machines, t).map((cell, index) => (
                <td key={head[index]} className="p-2">
                  {type === 'machine' && index === 0 ? (
                    <Link
                      to={`/analytics/machines/${row.id}`}
                      className="inline-flex min-h-target-min items-center font-semibold text-accent-text"
                    >
                      {cell}
                    </Link>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The way back: a link to the group for the page drill, a button that clears the filter for a tile. */
function BackAction({
  group,
  onBack,
  backLabel,
}: {
  group: AnalyticsGroup;
  onBack?: () => void;
  backLabel?: string;
}) {
  const { t } = useTranslation();
  const className =
    'inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text';
  return onBack === undefined ? (
    <Link to={`/analytics/${group.id}`} className={className}>
      {t('analytics.drill.back')}
    </Link>
  ) : (
    <button type="button" onClick={onBack} className={className}>
      {backLabel ?? t('analytics.drill.back')}
    </button>
  );
}

/** The reply's four states, in the face's established words. */
function DrillBody({
  type,
  loading,
  failed,
  hasReply,
  rows,
  machines,
}: {
  type: DrillType;
  loading: boolean;
  failed: boolean;
  hasReply: boolean;
  rows: readonly Row[];
  machines: Config['machines'] | undefined;
}) {
  const { t } = useTranslation();
  if (loading)
    return (
      <p role="status" className="text-body text-neutral-600">
        {t('common.loading')}
      </p>
    );
  if (failed)
    return (
      <p role="alert" className="text-body font-medium text-neutral-900">
        {t('kit.pattern.error')}
      </p>
    );
  if (!hasReply || rows.length === 0)
    return <p className="text-body text-neutral-600">{t('analytics.drill.empty')}</p>;
  return <DrillRows type={type} rows={rows} machines={machines} />;
}

/**
 * The rows a figure drilled to: a plain table of what identifies each one. A5's tile click (41e-1) narrows the
 * same drill reply by cell or location, and owns the heading and the way back, so the one table keeps one renderer.
 */
export function DrillTable({
  group,
  drill,
  where,
  title,
  onBack,
  backLabel,
  bare = false,
}: {
  group: AnalyticsGroup;
  drill: Drill;
  /** Inside a template's drill area, which has the card and the heading: only the way back and the rows. */
  bare?: boolean;
  /** A tile's filter over the reply's rows; absent for the figure's own drill. */
  where?: (row: Row) => boolean;
  title?: string;
  /** A filter's way back stays on the screen; the page drill's way back leaves for the group. */
  onBack?: () => void;
  backLabel?: string;
}) {
  const { t } = useTranslation();
  const reply = useQuery({
    queryKey: ['analytics-drill', drill.type, drill.ids],
    queryFn: () => getDrill(drill.type, drill.ids),
  });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const rows =
    where === undefined ? (reply.data?.rows ?? []) : (reply.data?.rows ?? []).filter(where);
  return (
    <section
      className={
        bare ? 'flex flex-col gap-2' : 'flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-card'
      }
    >
      <div className="flex items-center justify-between gap-2">
        {bare ? null : (
          <h2 className="text-title3 font-semibold">{title ?? t('analytics.drill.title')}</h2>
        )}
        <BackAction group={group} onBack={onBack} backLabel={backLabel} />
      </div>
      <DrillBody
        type={drill.type}
        loading={reply.isLoading}
        failed={reply.error !== null}
        hasReply={reply.data !== undefined}
        rows={rows}
        machines={config.data?.machines}
      />
    </section>
  );
}
