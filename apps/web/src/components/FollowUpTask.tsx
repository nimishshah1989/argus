import { useTranslation } from 'react-i18next';
import type { TaskInput } from '@uptimo/shared/tasks';
import type { Config } from '../api.js';
import { Card } from '../ui/card.js';
import { Checkbox, Input, Label, Select, Textarea } from '../ui/input.js';
import { Stack } from '../ui/layout.js';

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

/**
 * "Leave a follow-up task" on the close screens (`v3.actions.17`): the job is not finished, so the ticket
 * leaves a child task with what is left, the plant's reason for it and the day it is expected.
 */
function TaskLeaveFields({
  config,
  draft,
  onChange,
}: {
  config: Config;
  draft: TaskDraft;
  onChange: (draft: TaskDraft) => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap={3}>
      <p className="text-footnote text-neutral-600">{t('tasks.leaveHint')}</p>
      <Stack gap={1}>
        <Label htmlFor="close-task-text">{t('tasks.what')}</Label>
        <Textarea
          id="close-task-text"
          maxLength={300}
          value={draft.text}
          onChange={(event) => onChange({ ...draft, text: event.target.value })}
        />
      </Stack>
      <Stack gap={1}>
        <Label htmlFor="close-task-reason">{t('tasks.reason')}</Label>
        <Select
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
        </Select>
      </Stack>
      <Stack gap={1}>
        <Label htmlFor="close-task-date">{t('tasks.expectedLabel')}</Label>
        <Input
          id="close-task-date"
          type="date"
          value={draft.expectedOn}
          onChange={(event) => onChange({ ...draft, expectedOn: event.target.value })}
        />
        <p className="text-caption text-neutral-600">{t('tasks.expectedHint')}</p>
      </Stack>
    </Stack>
  );
}

export function TaskLeaveCard({
  config,
  draft,
  onChange,
}: {
  config: Config;
  draft: TaskDraft;
  onChange: (draft: TaskDraft) => void;
}) {
  const { t } = useTranslation();
  if (reasonsOf(config).length === 0) return null;
  return (
    <div data-testid="follow-up-task">
      <Card title={t('tasks.thisTask')}>
        <Checkbox
          label={t('tasks.leave')}
          checked={draft.on}
          onChange={(event) => onChange({ ...draft, on: event.target.checked })}
        />
        {draft.on ? <TaskLeaveFields config={config} draft={draft} onChange={onChange} /> : null}
        {taskReady(draft) ? null : (
          <p role="status" data-testid="task-incomplete" className="text-footnote text-danger">
            {t('tasks.incomplete')}
          </p>
        )}
      </Card>
    </div>
  );
}
