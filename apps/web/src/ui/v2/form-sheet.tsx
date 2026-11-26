import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../../data/index.js';
import type { FormField, FormSheetProps } from '../../patterns/form-sheet.js';
import { offlineNotice } from '../../patterns/view-state.js';
import { missingRequired, submitHeld } from './crud-model.js';
import { DateField } from './date-field.js';
import { Drawer } from './drawer.js';
import { Segmented } from './segmented.js';
import { SelectField } from './select-field.js';

/** One labelled control: a bar or a menu for a choice, the browser's own pickers for day and time, a text box otherwise. */
export function Field(p: { field: FormField; value: string; onChange: (value: string) => void }) {
  const { field, value, onChange } = p;
  const choices = field.choices ?? [];
  // v1's rule (ADR 0053): up to four choices are a bar of buttons, more are a menu.
  if (field.kind === 'choice' && choices.length <= 4)
    return (
      <div className="v2-crud-field">
        <span aria-hidden="true">{field.label}</span>
        <Segmented
          label={field.label}
          options={choices.map((c) => ({ key: c.value, label: c.label }))}
          value={value}
          onChange={onChange}
        />
      </div>
    );
  if (field.kind === 'choice')
    return (
      <SelectField
        label={field.label}
        all=""
        value={value}
        options={choices.map((c) => ({ key: c.value, label: c.label }))}
        onChange={onChange}
      />
    );
  // The kit's day field is always required, so an optional day uses the plain box below.
  if (field.kind === 'date' && field.required)
    return <DateField label={field.label} value={value} onChange={onChange} />;
  const Control = field.multiline ? 'textarea' : 'input';
  return (
    <label className="v2-crud-field">
      {field.label}
      <Control
        type={field.multiline ? undefined : (field.kind ?? 'text')}
        required={field.required}
        maxLength={field.maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Hint({ text, status }: { text?: string | null; status?: boolean }) {
  return text ? (
    <p role={status ? 'status' : undefined} className="v2-crud-hint">
      {text}
    </p>
  ) : null;
}

function Form(p: FormSheetProps) {
  const { t } = useTranslation();
  const online = useOnline();
  const [values, setValues] = useState<Record<string, string>>(p.initial ?? {});
  const held = submitHeld({
    pending: p.pending,
    online: online || p.offlineAllowed,
    missing: missingRequired(p.fields, values),
    blocked: p.blocked?.(values),
  });
  const note = p.note?.(values);
  const notice = offlineNotice(online, p.offlineAllowed);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (held) return;
    if (await p.onSubmit(values)) p.onOpenChange(false);
  }

  return (
    <form className="v2-crud-form" aria-label={p.title} onSubmit={(e) => void submit(e)}>
      <h2>{p.title}</h2>
      <Hint text={p.description} />
      {p.fields.map((f) => (
        <Field
          key={f.name}
          field={f}
          value={values[f.name] ?? ''}
          onChange={(v) => setValues({ ...values, [f.name]: v })}
        />
      ))}
      <Hint text={note} />
      <Hint text={p.actingAs} />
      {/* Offline: a sheet whose command queues says it will send on reconnect; one that needs the server says so. */}
      <Hint text={notice ? t(notice) : undefined} status />

      {p.error ? (
        <p role="alert" className="v2-crud-hint">
          {p.error}
        </p>
      ) : null}
      <div className="v2-crud-actions">
        {p.backLabel ? (
          <button
            type="button"
            className="v2-btn v2-btn-ghost"
            onClick={() => p.onOpenChange(false)}
          >
            {p.backLabel}
          </button>
        ) : null}
        <button type="submit" className="v2-btn v2-btn-primary" disabled={held !== null}>
          {p.pending ? t('common.sending') : p.submitLabel}
        </button>
      </div>
      <Hint text={p.footnote} />
    </form>
  );
}

/** v1's `FormSheet` in the kit's look: the right drawer holding the form; closed, it draws nothing. */
export function FormSheet(p: FormSheetProps) {
  return (
    <Drawer
      drawer={
        p.open
          ? { label: p.title, onClose: () => p.onOpenChange(false), content: <Form {...p} /> }
          : null
      }
    />
  );
}
