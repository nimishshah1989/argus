import { useTranslation } from 'react-i18next';
import type { TaskInput } from '@uptimo/shared/tasks';
import type { Config } from '../../../../api.js';
import { Field } from '../../../../ui/v2/close-kit.js';
import { TickRow } from '../../../../ui/v2/tick-row.js';

/** What the close screens hold before the task is sent. */
export interface TaskDraft {
  on: boolean;
  text: string;
  reasonCode: string;
  expectedOn: string;
}

export const NO_TASK: TaskDraft = { on: false, text: '', reasonCode: '', expectedOn: '' };

/** A ticked task needs its words and the plant's reason before the close may send, or it would be lost. */
export function taskReady(draft: TaskDraft): boolean {
  return !draft.on || (draft.text.trim() !== '' && draft.reasonCode !== '');
}

/** The server's shape, or nothing when the person left the boxes empty (a close without a task). */
export function taskInput(draft: TaskDraft): TaskInput | undefined {
  const text = draft.text.trim();
  if (!draft.on || !text || !draft.reasonCode) return undefined;
  return {
    text,
    reasonCode: draft.reasonCode,
    ...(draft.expectedOn ? { expectedOn: draft.expectedOn } : {}),
  };
}

/** The plant's own task reasons, with the ones switched off left out. */
function reasonsOf(config: Config) {
  return (config.lists.task_reason ?? []).filter((item) => item.active !== false);
}

interface TaskProps {
  config: Config;
  draft: TaskDraft;
  onChange: (draft: TaskDraft) => void;
}

/**
 * "Leave a follow-up task" on the close screens (`v3.actions.17`): the job is not finished, so the ticket
 * leaves a child task with what is left, the plant's reason for it and the day it is expected.
 */
function TaskLeaveFields({ config, draft, onChange }: TaskProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className="v2-sub">{t('tasks.leaveHint')}</p>
      <Field id="close-task-text" label={t('tasks.what')}>
        <textarea
          id="close-task-text"
          maxLength={300}
          value={draft.text}
          onChange={(event) => onChange({ ...draft, text: event.target.value })}
        />
      </Field>
      <Field id="close-task-reason" label={t('tasks.reason')}>
        <select
          id="close-task-reason"
          value={draft.reasonCode}
          onChange={(event) => onChange({ ...draft, reasonCode: event.target.value })}
        >
          <option value="" />
          {reasonsOf(config).map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="close-task-date" label={t('tasks.expectedLabel')}>
        <input
          id="close-task-date"
          type="date"
          value={draft.expectedOn}
          onChange={(event) => onChange({ ...draft, expectedOn: event.target.value })}
        />
        <p className="v2-crud-hint">{t('tasks.expectedHint')}</p>
      </Field>
    </div>
  );
}

export function TaskLeaveCard({ config, draft, onChange }: TaskProps) {
  const { t } = useTranslation();
  if (reasonsOf(config).length === 0) return null;
  return (
    <div data-testid="follow-up-task" className="v2-card v2-pad">
      <h3 className="v2-h3">{t('tasks.thisTask')}</h3>
      <TickRow
        label={t('tasks.leave')}
        checked={draft.on}
        onChange={(on) => onChange({ ...draft, on })}
      />
      {draft.on ? <TaskLeaveFields config={config} draft={draft} onChange={onChange} /> : null}
      {taskReady(draft) ? null : (
        <p role="status" data-testid="task-incomplete" className="v2-sub v2-task-incomplete">
          {t('tasks.incomplete')}
        </p>
      )}
    </div>
  );
}
