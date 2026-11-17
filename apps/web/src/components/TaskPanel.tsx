/* eslint-disable i18next/no-literal-string -- status group ids and prop values, not copy */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Config, TicketDetail } from '../api.js';
import { formatMinutes } from './format.js';
import { Card } from '../ui/card.js';
import { SectionTitle } from '../ui/detail-kit.js';
import { Inline, Stack } from '../ui/layout.js';
import { StatusPill } from '../ui/status/status-pill.js';

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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-caption text-neutral-600">{label}</dt>
      <dd className="text-body font-bold">{value}</dd>
    </div>
  );
}

/** A task's own detail: the breakdown it was left from, and what it was left for. */
function LeftFrom({ detail, labels }: { detail: TicketDetail; labels: Record<string, string> }) {
  const { t } = useTranslation();
  const { parent, ticket } = detail;
  if (!parent) return null;
  return (
    <Card>
      <Link to={`/desk/${parent.id}`} className="text-body font-semibold text-accent-text">
        {t('tasks.left', { ref: parent.ref })}
      </Link>
      <dl className="flex flex-wrap gap-4">
        <Fact
          label={t('tasks.reason')}
          value={ticket.taskReason ? (labels[ticket.taskReason] ?? ticket.taskReason) : '—'}
        />
        <Fact label={t('tasks.expectedOn')} value={ticket.taskExpectedOn ?? '—'} />
        {ticket.taskDownMin === null ? null : (
          <Fact label={t('tasks.stoppedMinutes')} value={formatMinutes(ticket.taskDownMin)} />
        )}
      </dl>
    </Card>
  );
}

function TaskLink({ task, labels }: { task: TaskRow; labels: Record<string, string> }) {
  const { t } = useTranslation();
  return (
    <li>
      <Link
        to={`/desk/${task.id}`}
        className="flex min-h-target flex-col gap-1 rounded-2xl bg-surface p-4 shadow-card"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="font-mono text-caption font-medium text-neutral-700">{task.ref}</span>
          <StatusPill group="task" id={task.state} />
        </span>
        <span className="text-body">{task.text}</span>
        <span className="text-footnote text-neutral-600">{taskLine(task, labels, t)}</span>
      </Link>
    </li>
  );
}

/**
 * The follow-up box on a ticket (`v3.actions.17`): the tasks left from it with their state, reason and date,
 * or, when the ticket is itself a task, the breakdown it came from. The state is colour, icon and word.
 */
export function TaskPanel({ detail, config }: { detail: TicketDetail; config?: Config }) {
  const { t } = useTranslation();
  const { tasks, taskSummary, parent } = detail;
  if (!parent && tasks.length === 0) return null;
  const labels = reasonLabels(config);
  const label = t(parent ? 'tasks.thisTask' : 'tasks.title');
  const box = taskSummary.box;
  return (
    <section aria-label={label} data-testid="tasks-panel" className="flex flex-col gap-2">
      <SectionTitle>{label}</SectionTitle>
      <LeftFrom detail={detail} labels={labels} />
      {tasks.length > 0 ? (
        <Stack gap={2}>
          <Inline gap={2}>
            {box === 'none' ? null : <StatusPill group="task" id={box} />}
            <p className="text-footnote text-neutral-600">
              {t('tasks.summary', {
                pending: taskSummary.pending,
                inProgress: taskSummary.inProgress,
                overdue: taskSummary.overdue,
                done: taskSummary.done,
              })}
            </p>
          </Inline>
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskLink key={task.id} task={task} labels={labels} />
            ))}
          </ul>
        </Stack>
      ) : null}
    </section>
  );
}
