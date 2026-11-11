import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

const CLOSE_OPTION_KEYS: Record<RaiseKind, { value: string; key: string }[]> = {
  stopped: [
    { value: 'report', key: 'close.report' },
    { value: 'no_report', key: 'close.noReport' },
  ],
  support: [
    { value: 'report', key: 'close.report' },
    { value: 'no_report', key: 'close.noReport' },
  ],
  general: [{ value: 'done', key: 'close.done' }],
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

interface FieldDeps {
  action: CommandAction;
  kind: RaiseKind;
  config: Config;
  personId: string;
}

function rosterFields(t: TFunction, action: CommandAction): FieldSpec[] | null {
  if (action === 'join') {
    return [
      {
        name: 'role',
        label: t('action.role'),
        type: 'select',
        required: true,
        options: [
          { value: 'primary', label: t('action.rolePrimary') },
          { value: 'support', label: t('action.roleSupport') },
        ],
      },
    ];
  }
  if (action === 'leave') {
    return [{ name: 'reason', label: t('action.leaveReason'), type: 'textarea', required: true }];
  }
  return null;
}

function fieldsFor(t: TFunction, deps: FieldDeps): FieldSpec[] {
  const { action, kind, config, personId } = deps;
  const roster = rosterFields(t, action);
  if (roster) return roster;
  if (action === 'pause') {
    return [
      {
        name: 'reasonCode',
        label: t('action.waitingFor'),
        type: 'select',
        required: true,
        options: listOptions(config, 'wait_reason'),
      },
      { name: 'note', label: t('action.note'), type: 'textarea' },
    ];
  }
  if (action === 'update') {
    return [{ name: 'text', label: t('action.whatChanged'), type: 'textarea', required: true }];
  }
  if (action === 'transfer') {
    return [
      { name: 'note', label: t('action.handoverNote'), type: 'textarea', required: true },
      {
        name: 'toPersonId',
        label: t('action.handTo'),
        type: 'select',
        options: peopleOptions(config, personId),
      },
    ];
  }
  if (action === 'close') {
    return [
      {
        name: 'kind',
        label: t('action.howClosing'),
        type: 'select',
        required: true,
        options: CLOSE_OPTION_KEYS[kind].map((option) => ({ ...option, label: t(option.key) })),
      },
      { name: 'note', label: t('action.note'), type: 'textarea', hint: t('action.noteRequired') },
    ];
  }
  if (action === 'cancel') {
    return [{ name: 'reason', label: t('action.whyCancel'), type: 'textarea', required: true }];
  }
  return [];
}

function trimmed(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
}

function noteOf(values: Record<string, string>): { note?: string } {
  return values.note ? { note: values.note } : {};
}

type BodyBuilder = (personId: string, values: Record<string, string>) => CommandBody | null;

const BODY_BUILDERS: Partial<Record<CommandAction, BodyBuilder>> = {
  pause: (personId, values) =>
    values.reasonCode ? { personId, reasonCode: values.reasonCode, ...noteOf(values) } : null,
  update: (personId, values) => (values.text ? { personId, text: values.text } : null),
  transfer: (personId, values) => {
    if (!values.note) return null;
    const target = values.toPersonId ? { toPersonId: values.toPersonId } : {};
    return { personId, note: values.note, ...target };
  },
  close: (personId, values) => {
    if (!values.kind) return null;
    if (values.kind === 'no_report' && !values.note) return null;
    return { personId, kind: values.kind as CloseKind, ...noteOf(values) };
  },
  cancel: (personId, values) => (values.reason ? { personId, reason: values.reason } : null),
  join: (personId, values) =>
    values.role === 'primary' || values.role === 'support' ? { personId, role: values.role } : null,
  leave: (personId, values) => (values.reason ? { personId, reason: values.reason } : null),
};

function buildBody(
  action: CommandAction,
  personId: string,
  values: Record<string, string>,
): CommandBody | null {
  return BODY_BUILDERS[action]?.(personId, values) ?? null;
}

interface FieldsProps {
  fields: FieldSpec[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

function FormFields({ fields, values, onChange }: FieldsProps) {
  const { t } = useTranslation();
  return (
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
              onChange={(event) => onChange(field.name, event.target.value)}
              className={inputClass}
            >
              <option value="">{t('common.choose')}</option>
              {(field.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <textarea
              value={values[field.name] ?? ''}
              onChange={(event) => onChange(field.name, event.target.value)}
              className={`${inputClass} min-h-24 py-3`}
            />
          )}
          {field.hint && <span className="mt-1 block text-xs text-neutral-500">{field.hint}</span>}
        </label>
      ))}
    </div>
  );
}

interface ActionsProps {
  pending: boolean;
  disabled: boolean;
  submitLabel: string;
  onDone: () => void;
}

function FormActions({ pending, disabled, submitLabel, onDone }: ActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        onClick={onDone}
        className="min-h-13 flex-1 rounded-xl border border-neutral-300 bg-white px-4 text-base font-semibold text-neutral-900 hover:bg-neutral-100"
      >
        {t('common.back')}
      </button>
      <button
        type="submit"
        disabled={disabled || pending}
        className="min-h-13 flex-1 rounded-xl bg-accent px-4 text-base font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
      >
        {pending ? t('common.saving') : submitLabel}
      </button>
    </div>
  );
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

const TITLE_KEYS: Record<string, string> = {
  join: 'action.join.title',
  leave: 'action.leave.title',
  pause: 'action.pause.title',
  update: 'action.update.title',
  transfer: 'action.transfer.title',
  close: 'action.close.title',
  cancel: 'action.cancel.title',
};

const SUBMIT_KEYS: Record<string, string> = {
  join: 'action.join.submit',
  leave: 'action.leave.submit',
  pause: 'action.pause.submit',
  update: 'action.update.submit',
  transfer: 'action.transfer.submit',
  close: 'action.close.submit',
  cancel: 'action.cancel.submit',
};

/** Join defaults to support; every other form starts empty. */
function initialValues(action: CommandAction): Record<string, string> {
  return action === 'join' ? { role: 'support' } : {};
}

export function ActionForm({ action, personId, kind, config, pending, onRun, onDone }: Props) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(action));
  const fields = fieldsFor(t, { action, kind, config, personId });
  const body = buildBody(action, personId, trimmed(values));
  const title = t(TITLE_KEYS[action] ?? action);
  const submitLabel = t(SUBMIT_KEYS[action] ?? action);

  function update(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body || pending) return;
    if (await onRun(action, body)) onDone();
  }

  return (
    <form onSubmit={submit} aria-label={title} className="mt-4 rounded-xl bg-neutral-50 p-4">
      <h3 className="text-base font-semibold">{title}</h3>
      <FormFields fields={fields} values={values} onChange={update} />
      <FormActions pending={pending} disabled={!body} submitLabel={submitLabel} onDone={onDone} />
    </form>
  );
}
