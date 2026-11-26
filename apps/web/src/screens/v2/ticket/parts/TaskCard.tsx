/* eslint-disable i18next/no-literal-string -- status group ids and prop values, not copy */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Config, TicketDetail } from '../../../../api.js';
import { formatMinutes } from '../../../../components/format.js';
import { StatusTag } from './StatusTag.js';

type TaskRow = TicketDetail['tasks'][number];

/** The plant's own words for a task's reason; a code the list dropped still says something. */
function reasonLabels(config?: Config): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const item of config?.lists.task_reason ?? []) labels[item.code] = item.label;
  return labels;
}

/** "Waiting for spare · expected 2026-11-20 · 45 min machine-stopped": what a task row says under its words. */
function taskLine(task: TaskRow, labels: Record<string, string>, t: TFunction): string {
  const parts = [
    task.taskReason ? (labels[task.taskReason] ?? task.taskReason) : null,
    task.taskExpectedOn ? t('tasks.expected', { date: task.taskExpectedOn }) : null,
    task.taskDownMin === null
      ? null
      : t('tasks.downMin', { minutes: formatMinutes(task.taskDownMin) }),
  ];
  return parts.filter(Boolean).join(' · ');
}

/** A task's own detail: the breakdown it was left from, and what it was left for. */
function LeftFrom({ detail, labels }: { detail: TicketDetail; labels: Record<string, string> }) {
  const { t } = useTranslation();
  const { parent, ticket } = detail;
  if (!parent) return null;
  const facts = [
    {
      label: t('tasks.reason'),
      value: ticket.taskReason ? (labels[ticket.taskReason] ?? ticket.taskReason) : '—',
    },
    { label: t('tasks.expectedOn'), value: ticket.taskExpectedOn ?? '—' },
    ...(ticket.taskDownMin === null
      ? []
      : [{ label: t('tasks.stoppedMinutes'), value: formatMinutes(ticket.taskDownMin) }]),
  ];
  return (
    <div className="v2-stack v2-ticket-gap">
      <Link to={`/desk/${parent.id}`} className="v2-ticket-link">
        {t('tasks.left', { ref: parent.ref })}
      </Link>
      <dl className="v2-facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="v2-sub">{fact.label}</dt>
            <dd className="v2-fact-value">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TaskLink({ task, labels }: { task: TaskRow; labels: Record<string, string> }) {
  const { t } = useTranslation();
  return (
    <li>
      <Link to={`/desk/${task.id}`} className="v2-ticket-task">
        <span className="v2-ticket-task-head">
          <span className="v2-sub v2-num">{task.ref}</span>
          <StatusTag status={{ group: 'task', id: task.state }} />
        </span>
        <span>{task.text}</span>
        <span className="v2-sub">{taskLine(task, labels, t)}</span>
      </Link>
    </li>
  );
}

/**
 * The follow-up card on a ticket (v1 `TaskPanel`, `v3.actions.17`): the tasks left from it with their state, reason
 * and date, or, when the ticket is itself a task, the breakdown it came from. The state is colour, icon and word.
 */
export function TaskCard({ detail, config }: { detail: TicketDetail; config?: Config }) {
  const { t } = useTranslation();
  const { tasks, taskSummary, parent } = detail;
  if (!parent && tasks.length === 0) return null;
  const labels = reasonLabels(config);
  const label = t(parent ? 'tasks.thisTask' : 'tasks.title');
  const box = taskSummary.box;
  return (
    <section
      aria-label={label}
      data-testid="tasks-panel"
      className="v2-card v2-pad v2-stack v2-ticket-gap"
    >
      <h2 className="v2-h2">{label}</h2>
      <LeftFrom detail={detail} labels={labels} />
      {tasks.length > 0 ? (
        <>
          <div className="v2-ticket-chips">
            {box === 'none' ? null : <StatusTag status={{ group: 'task', id: box }} />}
            <p className="v2-sub">
              {t('tasks.summary', {
                pending: taskSummary.pending,
                inProgress: taskSummary.inProgress,
                overdue: taskSummary.overdue,
                done: taskSummary.done,
              })}
            </p>
          </div>
          <ul className="v2-ticket-tasks">
            {tasks.map((task) => (
              <TaskLink key={task.id} task={task} labels={labels} />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
