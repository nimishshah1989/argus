/* eslint-disable i18next/no-literal-string -- prop values only; every visible string goes through t() */
import { useTranslation } from 'react-i18next';
import type { CommandBody, Config, Ticket } from '../api.js';
import type { TaskInput } from '@uptimo/shared/tasks';
import { FormSheet, type FormField } from '../patterns/form-sheet.js';
import { machineLabel } from './format.js';

export interface CloseSheetProps {
  ticket: Ticket;
  config: Config;
  personId: string;
  pending: boolean;
  error: string | null;
  onRun: (action: 'close', body: CommandBody) => Promise<boolean>;
  onClose: () => void;
}

/** The server's cap on a close note; a longer one queued offline would be refused on replay. */
const NOTE_MAX = 2000;
/** The server's cap on a task's words. */
const TASK_TEXT_MAX = 300;
/** The server's cap on the minutes a task left the machine stopped: whole minutes, 0 to a day. */
const DOWN_MIN_MAX = 1440;

/** Whole minutes from 0 to 1440: what the server takes, and what a queued command may carry. */
function downMinOk(raw: string): boolean {
  return /^\d+$/.test(raw) && Number(raw) <= DOWN_MIN_MAX;
}

/** The task a close leaves behind, if the person filled the two boxes that make one. */
function taskOf(values: Record<string, string>): { task?: TaskInput } {
  const text = (values.taskText ?? '').trim();
  const reasonCode = values.taskReason ?? '';
  if (!text || !reasonCode) return {};
  const expectedOn = (values.taskExpectedOn ?? '').trim();
  return { task: { text, reasonCode, ...(expectedOn ? { expectedOn } : {}) } };
}

/** The plant's own task reasons, with the ones switched off left out. */
function reasonChoices(config: Config): { value: string; label: string }[] {
  return (config.lists.task_reason ?? [])
    .filter((item) => item.active !== false)
    .map((item) => ({ value: item.code, label: item.label }));
}

const NOTE = (label: string): FormField => ({
  name: 'note',
  label,
  required: true,
  multiline: true,
  maxLength: NOTE_MAX,
});

/** The quick closes say what happened, and (for a task) the minutes the machine stood still. */
function CloseSheet(
  p: CloseSheetProps & {
    title: string;
    description?: string;
    submit: string;
    fields: FormField[];
    footnote?: string;
    note?: (values: Record<string, string>) => string | null;
    blocked?: (values: Record<string, string>) => boolean;
    body: (values: Record<string, string>) => CommandBody;
  },
) {
  const name = p.config.people.find((person) => person.id === p.personId)?.name ?? '';
  const { t } = useTranslation();
  return (
    <FormSheet
      open
      onOpenChange={(open) => {
        if (!open) p.onClose();
      }}
      title={p.title}
      description={p.description}
      submitLabel={p.submit}
      backLabel={t('closes.back')}
      actingAs={name ? t('closes.actingAs', { name }) : undefined}
      fields={p.fields}
      footnote={p.footnote}
      note={p.note}
      blocked={p.blocked}
      offlineAllowed
      pending={p.pending}
      error={p.error}
      onSubmit={(values) => p.onRun('close', p.body(values))}
    />
  );
}

/** Close without report (S4-1): a reason, and the ticket waits under Needs report. */
export function NoReportSheet(p: CloseSheetProps) {
  const { t } = useTranslation();
  const reasons = reasonChoices(p.config);
  const fields: FormField[] = [
    NOTE(t('closes.noReport.reason')),
    { name: 'taskText', label: t('tasks.what'), multiline: true, maxLength: TASK_TEXT_MAX },
    ...(reasons.length
      ? [
          {
            name: 'taskReason',
            label: t('tasks.reason'),
            kind: 'choice' as const,
            choices: reasons,
          },
        ]
      : []),
    { name: 'taskExpectedOn', label: t('tasks.expectedLabel'), kind: 'date' as const },
  ];
  return (
    <CloseSheet
      {...p}
      title={t('closes.noReport.title', { machine: machineLabel(p.ticket, p.config.machines) })}
      description={t('closes.noReport.hint')}
      submit={t('closes.noReport.submit')}
      footnote={reasons.length ? t('tasks.leaveHint') : undefined}
      fields={fields}
      note={(values) =>
        Boolean((values.taskText ?? '').trim()) !== Boolean(values.taskReason)
          ? t('tasks.incomplete')
          : null
      }
      blocked={(values) => Boolean((values.taskText ?? '').trim()) !== Boolean(values.taskReason)}
      body={(values) => ({
        kind: 'no_report',
        note: (values.note ?? '').trim(),
        ...taskOf(values),
      })}
    />
  );
}

/** Mark done (S4-2): what was done, and the machine-stopped minutes when this is a follow-up task. */
export function DoneSheet(p: CloseSheetProps) {
  const { t } = useTranslation();
  const task = p.ticket.parentId !== null;
  const fields: FormField[] = [
    NOTE(t('closes.done.what')),
    ...(task ? [{ name: 'taskDownMin', label: t('tasks.stoppedMinutes'), required: true }] : []),
  ];
  return (
    <CloseSheet
      {...p}
      title={t('closes.done.title', { what: machineLabel(p.ticket, p.config.machines) })}
      description={p.ticket.problem}
      submit={t('closes.done.submit')}
      footnote={task ? t('tasks.stoppedMinutesHint') : undefined}
      fields={fields}
      note={(values) => {
        const raw = (values.taskDownMin ?? '').trim();
        return task && raw !== '' && !downMinOk(raw) ? t('tasks.stoppedMinutesInvalid') : null;
      }}
      blocked={(values) => task && !downMinOk((values.taskDownMin ?? '').trim())}
      body={(values) => ({
        kind: 'done',
        note: (values.note ?? '').trim(),
        ...(task ? { taskDownMin: Number((values.taskDownMin ?? '').trim()) } : {}),
      })}
    />
  );
}
