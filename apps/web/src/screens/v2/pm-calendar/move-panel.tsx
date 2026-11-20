import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { fill } from '../../../i18n/fill.js';
import { Button } from '../../../ui/v2/button.js';
import { DateField } from '../../../ui/v2/date-field.js';
import { Panel } from '../../../ui/v2/panel.js';
import type { PmCalendarWords, PmJob } from './model.js';

/**
 * The keyboard way to move a job: the calendar's drag has no keyboard, so every job a head may move has a "Move to
 * date" button that opens this form. The field takes focus; Enter moves the job, Escape cancels, and when the form
 * closes focus returns to the job's button. It is not animated (UX-RULES 39). The server still decides every date: its
 * refusal is read out here, in `role="alert"`, and the form stays open.
 */
export function MovePanel({
  job,
  words,
  busy,
  refusal,
  onMove,
  onClose,
}: {
  job: PmJob;
  words: PmCalendarWords['move'];
  busy: boolean;
  refusal: string | null;
  onMove: (job: PmJob, day: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [day, setDay] = useState(job.planned.iso);
  const [missing, setMissing] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => field.current?.focus(), []);
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (busy) return;
    setMissing(day === '');
    if (day !== '') void onMove(job, day);
  };
  const keys = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') onClose();
    // The browser's own date field does not always submit its form on Enter, so Enter says it here.
    if (event.key === 'Enter' && event.target === field.current) {
      event.preventDefault();
      form.current?.requestSubmit();
    }
  };
  return (
    <Panel title={fill(words.title, { machine: job.machine.label })}>
      <form ref={form} onSubmit={submit} onKeyDown={keys} className="v2-detail">
        <p className="v2-sub">{fill(words.now, { date: job.planned.shown })}</p>
        <DateField label={words.label} value={day} onChange={setDay} inputRef={field}>
          <Button primary onClick={() => form.current?.requestSubmit()}>
            {busy ? words.saving : words.confirm}
          </Button>
          <Button onClick={onClose}>{words.cancel}</Button>
        </DateField>
        {missing ? <p role="alert">{words.needDate}</p> : null}
        {refusal === null ? null : <p role="alert">{refusal}</p>}
      </form>
    </Panel>
  );
}

/** Puts focus back on a job's Move button once the form that came from it has closed. */
export function useRestoreFocus(chosen: PmJob | null): (job: PmJob) => void {
  const opener = useRef('');
  const wasOpen = useRef(false);
  useEffect(() => {
    if (chosen !== null) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const button = document.querySelector<HTMLElement>(
      `[data-job-button="${opener.current}"] button`,
    );
    button?.focus();
  }, [chosen]);
  return (job) => {
    opener.current = job.machine.label;
  };
}
