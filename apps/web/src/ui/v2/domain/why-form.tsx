import { useId, useState, type FormEvent } from 'react';
import { Button } from '../button.js';

export type WhyFormWords = {
  /** The form's own name for a screen reader. */
  form: string;
  title: string;
  /** One label per why, "Why 1" to "Why 5". */
  whys: readonly string[];
  conclusion: string;
  save: string;
  saved: string;
  pdf: string;
  cancel: string;
};

export type WhyBody = { whys: [string, string, string, string, string]; conclusion: string };

const BLANK: WhyBody['whys'] = ['', '', '', '', ''];

/** The draft a form opens with: a saved record's five whys and conclusion, or five blanks. */
function useWhyDraft(initial: WhyBody | null) {
  const [whys, setWhys] = useState<WhyBody['whys']>(initial?.whys ?? BLANK);
  const [conclusion, setConclusion] = useState(initial?.conclusion ?? '');
  const setWhy = (at: number, value: string) =>
    setWhys((now) => now.map((why, i) => (i === at ? value : why)) as WhyBody['whys']);
  return { whys, conclusion, setWhy, setConclusion };
}

/** The five whys, each a cause the team may leave blank, and the conclusion, the one required field. */
function WhyFields({
  id,
  words,
  draft: { whys, conclusion, setWhy: onWhy, setConclusion: onConclusion },
}: {
  id: string;
  words: WhyFormWords;
  draft: ReturnType<typeof useWhyDraft>;
}) {
  return (
    <>
      {words.whys.map((label, at) => (
        <div key={label} className="v2-ack-field">
          <label htmlFor={`${id}-why-${at}`}>{label}</label>
          <textarea
            id={`${id}-why-${at}`}
            rows={2}
            value={whys[at]}
            onChange={(event) => onWhy(at, event.target.value)}
          />
        </div>
      ))}
      <div className="v2-ack-field">
        <label htmlFor={`${id}-conclusion`}>{words.conclusion}</label>
        <textarea
          id={`${id}-conclusion`}
          required
          rows={3}
          value={conclusion}
          onChange={(event) => onConclusion(event.target.value)}
        />
      </div>
    </>
  );
}

/** Save (off until the conclusion is there), the PDF once a record is saved, and Cancel. */
function WhyActions({
  words,
  disabled,
  saving,
  completed,
  onPdf,
  onCancel,
}: {
  words: WhyFormWords;
  disabled: boolean;
  saving: boolean;
  completed: boolean;
  onPdf: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="v2-row v2-gap-8">
      <button
        type="submit"
        className="v2-btn v2-btn-primary"
        disabled={disabled}
        aria-busy={saving}
      >
        {words.save}
      </button>
      {completed ? <Button onClick={onPdf}>{words.pdf}</Button> : null}
      <Button onClick={onCancel}>{words.cancel}</Button>
    </div>
  );
}

/**
 * The five whys and the required conclusion of one breakdown. The caller says who the author is (the signed-in person,
 * written by the server) and whether a save is on its way; nothing is sent from here. Save stays off until the
 * conclusion is there; the PDF is offered once a record has been saved.
 */
export function WhyForm({
  words,
  heading,
  author,
  initial,
  completed,
  saving,
  saved,
  onSave,
  onPdf,
  onCancel,
}: {
  words: WhyFormWords;
  /** Which breakdown this is: the machine and the day. */
  heading: string;
  author: string;
  initial: WhyBody | null;
  completed: boolean;
  saving: boolean;
  saved: boolean;
  onSave: (body: WhyBody) => void;
  onPdf: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const draft = useWhyDraft(initial);
  const ready = draft.conclusion.trim() !== '';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (ready && !saving) onSave({ whys: draft.whys, conclusion: draft.conclusion });
  };
  return (
    <form className="v2-ack-form v2-card v2-pad" aria-label={words.form} onSubmit={submit}>
      <div>
        <h2 className="v2-h2">{words.title}</h2>
        <p className="v2-sub">{heading}</p>
        <p className="v2-sub">{author}</p>
      </div>
      <WhyFields id={id} words={words} draft={draft} />
      {saved ? (
        <p role="status" className="v2-sub">
          {words.saved}
        </p>
      ) : null}
      <WhyActions
        words={words}
        disabled={!ready || saving}
        saving={saving}
        completed={completed}
        onPdf={onPdf}
        onCancel={onCancel}
      />
    </form>
  );
}
