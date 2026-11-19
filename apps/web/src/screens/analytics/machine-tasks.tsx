import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getConfig, useTicketPages } from '../../api.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { StatusPill } from '../../ui/status/status-pill.js';
import { Section } from './parts.js';
import { displayDay } from './machine-values.js';
import { readMachineTasks, type MachineTaskRow } from './pm-calendar-view.js';

/** One task's words: its reference (the link to the desk), the problem, its status and, on a PM row, its day. */
function TaskRow({ row }: { row: MachineTaskRow }) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 p-2">
      <div className="flex min-w-0 flex-col">
        <Link
          to={`/desk/${encodeURIComponent(row.id)}`}
          className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
        >
          {row.ref}
        </Link>
        <span className="truncate text-footnote text-neutral-600">{row.problem}</span>
        {row.scheduledOn === null ? null : (
          <span className="text-caption text-neutral-600">
            {t('pm.tasks.scheduled', { date: displayDay(row.scheduledOn) })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {row.overdue ? (
          // eslint-disable-next-line i18next/no-literal-string -- prop values, not copy
          <StatusPill group="pm" id="overdue" />
        ) : null}
        <StatusBadge status={row.status} />
      </div>
    </li>
  );
}

/** One of the block's two lists: its heading, its quiet empty line, or its rows. */
function TaskList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: readonly MachineTaskRow[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-body font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-body text-neutral-600">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <TaskRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A machine page's Tasks block (ticket 50c, R9): its open (non-PM) tickets and its open PM jobs, live from the one
 * ticket list — no new endpoint. The split is the shared planned predicate; each row links to the desk. A failed
 * list says so quietly and never replaces the analytics body above it.
 */
export function MachineTasks({ machineId, today }: { machineId: string; today: string }) {
  const { t } = useTranslation();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const pages = useTicketPages({
    machineId,
    status: ['open', 'working', 'waiting'],
    limit: 200,
  });
  const tickets = pages.data?.pages.flatMap((page) => page.items) ?? [];
  const tasks = readMachineTasks(tickets, {
    today,
    timeZone: config.data?.timeZone,
  });
  return (
    <Section title={t('pm.tasks.title')}>
      <p className="text-footnote text-neutral-600">
        {t('pm.tasks.asOf', { date: displayDay(today) })}
      </p>
      {pages.isLoading ? (
        <p role="status" className="text-body text-neutral-600">
          {t('pm.tasks.loading')}
        </p>
      ) : pages.error ? (
        <p className="text-body text-neutral-600">{t('pm.tasks.unavailable')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <TaskList title={t('pm.tasks.open')} empty={t('pm.tasks.openEmpty')} rows={tasks.open} />
          <TaskList title={t('pm.tasks.pm')} empty={t('pm.tasks.pmEmpty')} rows={tasks.pm} />
        </div>
      )}
    </Section>
  );
}
