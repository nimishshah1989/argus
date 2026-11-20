import { useId, type FormEvent } from 'react';
import { Button } from '../button.js';

/** Domain kit: the Action Center's filters and the form that acknowledges one nudge. Every word arrives from the caller. */
export type NudgeFormWords = {
  title: string;
  owner: string;
  ownerNone: string;
  due: string;
  note: string;
  save: string;
  cancel: string;
};
export type NudgeFormValues = { owner: string; due: string; note: string };

/** A labelled choice with an "all" option first; the empty string is "all". */
export function FilterSelect({
  label,
  all,
  value,
  options,
  onChange,
}: {
  label: string;
  all: string;
  value: string;
  options: { key: string; label: string }[];
  onChange: (key: string) => void;
}) {
  const id = useId();
  return (
    <div className="v2-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A labelled search box that filters as the reader types. */
export function SearchField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="v2-field v2-grow">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="search" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/**
 * Who owns it, by when, and a note: the acknowledgement of one nudge. Nothing is sent here; the caller saves the values.
 */
export function NudgeForm({
  words,
  people,
  onSave,
  onCancel,
}: {
  words: NudgeFormWords;
  people: { id: string; name: string }[];
  onSave: (values: NudgeFormValues) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({
      owner: String(data.get('owner') ?? ''),
      due: String(data.get('due') ?? ''),
      note: String(data.get('note') ?? ''),
    });
  };
  return (
    <form className="v2-nudge-form" aria-label={words.title} onSubmit={submit}>
      <div className="v2-field">
        <label htmlFor={`${id}-owner`}>{words.owner}</label>
        <select id={`${id}-owner`} name="owner" defaultValue="">
          <option value="">{words.ownerNone}</option>
          {people.map((person) => (
            <option key={person.id} value={person.name}>
              {person.name}
            </option>
          ))}
        </select>
      </div>
      <div className="v2-field">
        <label htmlFor={`${id}-due`}>{words.due}</label>
        <input id={`${id}-due`} name="due" type="date" />
      </div>
      <div className="v2-field">
        <label htmlFor={`${id}-note`}>{words.note}</label>
        <input id={`${id}-note`} name="note" type="text" maxLength={500} />
      </div>
      <div className="v2-row v2-gap-8">
        <button type="submit" className="v2-btn v2-btn-primary">
          {words.save}
        </button>
        <Button onClick={onCancel}>{words.cancel}</Button>
      </div>
    </form>
  );
}
