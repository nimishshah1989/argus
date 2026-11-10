import { useState, type FormEvent } from 'react';
import type { CloseKind, CommandAction, CommandBody, Config, RaiseKind } from '../api.js';

interface FieldSpec {
  name: string;
  label: string;
  type: 'select' | 'textarea';
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
}

const inputClass =
  'mt-2 min-h-13 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base';

const TITLES: Record<string, string> = {
  pause: 'Pause the ticket',
  update: 'Log an update',
  transfer: 'Hand over the ticket',
  close: 'Close the ticket',
  cancel: 'Cancel the ticket',
};

const SUBMITS: Record<string, string> = {
  pause: 'Pause',
  update: 'Save update',
  transfer: 'Transfer',
  close: 'Close ticket',
  cancel: 'Cancel ticket',
};

const CLOSE_OPTIONS: Record<RaiseKind, { value: string; label: string }[]> = {
  stopped: [
    { value: 'report', label: 'With report' },
    { value: 'no_report', label: 'Without report' },
  ],
  support: [
    { value: 'report', label: 'With report' },
    { value: 'no_report', label: 'Without report' },
  ],
  general: [{ value: 'done', label: 'Done' }],
};

function listOptions(config: Config, list: string): { value: string; label: string }[] {
  return (config.lists[list] ?? [])
    .filter((item) => item.active !== false)
    .map((item) => ({ value: item.code, label: item.label }));
}

function peopleOptions(config: Config, personId: string): { value: string; label: string }[] {
  return (config.people ?? [])
    .filter((person) => person.active !== false && person.id !== personId)
    .map((person) => ({ value: person.id, label: person.name }));
}

function fieldsFor(
  action: CommandAction,
  kind: RaiseKind,
  config: Config,
  personId: string,
): FieldSpec[] {
  if (action === 'pause') {
    return [
      {
        name: 'reasonCode',
        label: 'Waiting for',
        type: 'select',
        required: true,
        options: listOptions(config, 'wait_reason'),
      },
      { name: 'note', label: 'Note', type: 'textarea' },
    ];
  }
  if (action === 'update') {
    return [{ name: 'text', label: 'What has changed?', type: 'textarea', required: true }];
  }
  if (action === 'transfer') {
    return [
      { name: 'note', label: 'Handover note', type: 'textarea', required: true },
      {
        name: 'toPersonId',
        label: 'Hand to',
        type: 'select',
        options: peopleOptions(config, personId),
      },
    ];
  }
  if (action === 'close') {
    return [
      {
        name: 'kind',
        label: 'How are you closing?',
        type: 'select',
        required: true,
        options: CLOSE_OPTIONS[kind],
      },
      {
        name: 'note',
        label: 'Note',
        type: 'textarea',
        hint: 'Required when closing without a report.',
      },
    ];
  }
  if (action === 'cancel') {
    return [{ name: 'reason', label: 'Why cancel?', type: 'textarea', required: true }];
  }
  return [];
}

function trimmed(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
}

function buildBody(
  action: CommandAction,
  personId: string,
  values: Record<string, string>,
): CommandBody | null {
  const note = values.note ? { note: values.note } : {};
  if (action === 'pause') {
    return values.reasonCode ? { personId, reasonCode: values.reasonCode, ...note } : null;
  }
  if (action === 'update') return values.text ? { personId, text: values.text } : null;
  if (action === 'transfer') {
    if (!values.note) return null;
    const target = values.toPersonId ? { toPersonId: values.toPersonId } : {};
    return { personId, note: values.note, ...target };
  }
  if (action === 'close') {
    if (!values.kind) return null;
    if (values.kind === 'no_report' && !values.note) return null;
    return { personId, kind: values.kind as CloseKind, ...note };
  }
  if (action === 'cancel') return values.reason ? { personId, reason: values.reason } : null;
  return null;
}

interface Props {
  action: CommandAction;
  personId: string;
  kind: RaiseKind;
  config: Config;
  pending: boolean;
  onRun: (action: CommandAction, body: CommandBody) => Promise<boolean>;
  onDone: () => void;
}

export function ActionForm({ action, personId, kind, config, pending, onRun, onDone }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const fields = fieldsFor(action, kind, config, personId);
  const body = buildBody(action, personId, trimmed(values));

  function update(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body || pending) return;
    if (await onRun(action, body)) onDone();
  }

  return (
    <form
      onSubmit={submit}
      aria-label={TITLES[action]}
      className="mt-4 rounded-xl bg-neutral-50 p-4"
    >
      <h3 className="text-base font-semibold">{TITLES[action]}</h3>
      <div className="mt-3 space-y-3">
        {fields.map((field) => (
          <label key={field.name} className="block">
            <span className="text-sm font-medium text-neutral-600">
              {field.label}
              {field.required ? <span aria-hidden="true"> *</span> : null}
            </span>
            {field.type === 'select' ? (
              <select
                value={values[field.name] ?? ''}
                onChange={(event) => update(field.name, event.target.value)}
                className={inputClass}
              >
                <option value="">Choose…</option>
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                value={values[field.name] ?? ''}
                onChange={(event) => update(field.name, event.target.value)}
                className={`${inputClass} min-h-24 py-3`}
              />
            )}
            {field.hint && (
              <span className="mt-1 block text-xs text-neutral-500">{field.hint}</span>
            )}
          </label>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="min-h-13 flex-1 rounded-xl border border-neutral-300 bg-white px-4 text-base font-semibold text-neutral-900 hover:bg-neutral-100"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!body || pending}
          className="min-h-13 flex-1 rounded-xl bg-accent px-4 text-base font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {pending ? 'Saving…' : SUBMITS[action]}
        </button>
      </div>
    </form>
  );
}
