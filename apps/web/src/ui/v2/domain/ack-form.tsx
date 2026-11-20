import { useId, type FormEvent } from 'react';
import { Button } from '../button.js';

export type AckFormWords = {
  title: string;
  ownerLabel: string;
  ownerNone: string;
  dueLabel: string;
  noteLabel: string;
  save: string;
  cancel: string;
};
export type AckBody = { owner: string; due: string; note: string };

/**
 * Acknowledge one nudge: who owns it (chosen from the plant's people, or nobody), the day it is due and a note. The
 * caller sends it and says when it is on its way; nothing is saved here. The owner is the person's name, as the
 * store keeps it.
 */
export function AckForm({
  words,
  people,
  saving,
  onSave,
  onCancel,
}: {
  words: AckFormWords;
  people: readonly string[];
  saving: boolean;
  onSave: (body: AckBody) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    onSave({
      owner: String(data.get('owner') ?? ''),
      due: String(data.get('due') ?? ''),
      note: String(data.get('note') ?? ''),
    });
  };
  return (
    <form className="v2-ack-form" aria-label={words.title} onSubmit={submit}>
      <div className="v2-ack-field">
        <label htmlFor={`${id}-owner`}>{words.ownerLabel}</label>
        <select id={`${id}-owner`} name="owner" defaultValue="">
          <option value="">{words.ownerNone}</option>
          {people.map((person) => (
            <option key={person} value={person}>
              {person}
            </option>
          ))}
        </select>
      </div>
      <div className="v2-ack-field">
        <label htmlFor={`${id}-due`}>{words.dueLabel}</label>
        <input id={`${id}-due`} name="due" type="date" />
      </div>
      <div className="v2-ack-field">
        <label htmlFor={`${id}-note`}>{words.noteLabel}</label>
        <input id={`${id}-note`} name="note" type="text" maxLength={500} />
      </div>
      <div className="v2-row v2-gap-8">
        <button type="submit" className="v2-btn v2-btn-primary" aria-busy={saving}>
          {words.save}
        </button>
        <Button onClick={onCancel}>{words.cancel}</Button>
      </div>
    </form>
  );
}
