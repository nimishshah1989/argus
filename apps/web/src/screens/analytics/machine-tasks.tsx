import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getConfig, useTicketPages } from '../../api.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { Card } from '../../ui/card.js';
import { StatusPill } from '../../ui/status/status-pill.js';
import { displayDay } from './machine-values.js';
import { readMachineTasks, type MachineTaskRow } from './pm-calendar-view.js';
import './register-parts.css';

/** One task's words: its reference (the link to the desk), the problem, its status and, on a PM row, its day. */
function TaskRow({ row }: { row: MachineTaskRow }) {
  const { t } = useTranslation();
  return (
    <li>
      <div>
        <Link to={`/desk/${encodeURIComponent(row.id)}`} className="rg-link">
          {row.ref}
        </Link>
        <span className="rg-sub">{row.problem}</span>
        {row.scheduledOn === null ? null : (
          <span className="rg-sub">
            {t('pm.tasks.scheduled', { date: displayDay(row.scheduledOn) })}
          </span>
        )}
      </div>
      <div className="rg-pair">
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
    <div className="rg-stack">
      <h4 className="rg-subhead">{title}</h4>
      {rows.length === 0 ? (
        <p className="rg-note">{empty}</p>
      ) : (
        <ul className="rg-rows">
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
 * ticket list, no new endpoint. The split is the shared planned predicate; each row links to the desk. A failed
 * list says so quietly and never replaces the analytics body beside it.
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
    <Card title={t('pm.tasks.title')}>
      <p className="rg-note">{t('pm.tasks.asOf', { date: displayDay(today) })}</p>
      {pages.isLoading ? (
        <p role="status" className="rg-note">
          {t('pm.tasks.loading')}
        </p>
      ) : pages.error ? (
        <p className="rg-note">{t('pm.tasks.unavailable')}</p>
      ) : (
        <div className="rg-stack">
          <TaskList title={t('pm.tasks.open')} empty={t('pm.tasks.openEmpty')} rows={tasks.open} />
          <TaskList title={t('pm.tasks.pm')} empty={t('pm.tasks.pmEmpty')} rows={tasks.pm} />
        </div>
      )}
    </Card>
  );
}
