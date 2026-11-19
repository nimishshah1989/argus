/* eslint-disable i18next/no-literal-string -- status group ids, tones and prop values, not copy */
import { useTranslation } from 'react-i18next';
import { taskState } from '@uptimo/shared/tasks';
import type { Config, Ticket } from '../../api.js';
import { machineLabel } from '../../components/format.js';
import { EmptyState } from '../../ui/elements/states.js';
import { AlarmClock, Clock } from '../../ui/icon.js';
import { StatusPill } from '../../ui/status/status-pill.js';
import { TicketCard as Card } from '../../ui/ticket-card.js';
import type { CardContext } from './Board.js';
import { pendingTasks } from './openLists.js';

/** Today where the plant is, `YYYY-MM-DD`: the day the server judges a task's date against. */
export function plantToday(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/**
 * The Tasks tab (`v3.actions.17`): the follow-up tasks left after a close, earliest expected date first,
 * each with its state as colour, icon and word, and the reason the plant offers for it.
 */
export function TasksList({
  open,
  config,
  ctx,
}: {
  open: Ticket[];
  config?: Config;
  ctx: CardContext;
}) {
  const { t } = useTranslation();
  const tasks = pendingTasks(open);
  const today = plantToday(config?.timeZone ?? 'UTC', new Date(ctx.now));
  const labels: Record<string, string> = {};
  for (const item of config?.lists.task_reason ?? []) labels[item.code] = item.label;
  if (tasks.length === 0) return <EmptyState title={t('tasks.tabEmpty')} />;
  return (
    <div data-testid="tasks-tab" className="flex flex-col gap-2">
      <p className="text-footnote text-neutral-600">{t('tasks.tabHint')}</p>
      <ul className="flex flex-col gap-3">
        {tasks.map((ticket) => {
          const state = taskState(ticket, today);
          const reason = ticket.taskReason ? (labels[ticket.taskReason] ?? ticket.taskReason) : '';
          const expected = ticket.taskExpectedOn
            ? t('tasks.expected', { date: ticket.taskExpectedOn })
            : '';
          const who = ticket.reportedByPersonId ? ctx.names[ticket.reportedByPersonId] : undefined;
          return (
            <li key={ticket.id}>
              <Card
                to={`/desk/${ticket.id}`}
                title={machineLabel(ticket, ctx.machines)}
                refLabel={ticket.ref}
                status={<StatusPill group="task" id={state} />}
                kind={{
                  text: [reason, expected].filter(Boolean).join(' · '),
                  tone: state === 'overdue' ? 'danger' : 'info',
                  icon: state === 'overdue' ? AlarmClock : Clock,
                }}
                problem={ticket.problem}
                meta={who ? t('tasks.leftBy', { who }) : t('tasks.thisTask')}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
