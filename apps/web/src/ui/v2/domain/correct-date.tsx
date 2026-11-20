import { useState } from 'react';
import { Button } from '../button.js';
import { Panel } from '../panel.js';

export type CorrectDateWords = { title: string; label: string; save: string; cancel: string };

/**
 * Correct one date: a labelled date field, Save and Cancel, and the server's refusal in words under it. The caller
 * sends the date and says when it is pending or refused; nothing is changed here.
 */
export function CorrectDate({
  words,
  sub,
  initial,
  pending,
  error,
  onSave,
  onCancel,
}: {
  words: CorrectDateWords;
  /** What is being corrected, as a quiet line under the title. */
  sub: string;
  /** The day it stands at now, `YYYY-MM-DD`. */
  initial: string;
  pending: boolean;
  error: string | null;
  onSave: (day: string) => void;
  onCancel: () => void;
}) {
  const [day, setDay] = useState(initial);
  return (
    <Panel title={words.title} sub={sub}>
      <form
        className="v2-correct-date"
        aria-label={words.title}
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) onSave(day);
        }}
      >
        <label>
          {words.label}
          <input type="date" value={day} required onChange={(e) => setDay(e.target.value)} />
        </label>
        <Button primary onClick={() => !pending && onSave(day)}>
          {words.save}
        </Button>
        <Button onClick={onCancel}>{words.cancel}</Button>
      </form>
      {error ? (
        <p role="alert" className="v2-sub v2-seg-loss">
          {error}
        </p>
      ) : null}
    </Panel>
  );
}
