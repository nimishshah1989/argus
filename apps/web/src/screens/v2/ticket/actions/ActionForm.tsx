import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { CommandAction, CommandBody, Config } from '../../../../api.js';

interface FieldSpec {
  name: string;
  label: string;
  type: 'select' | 'textarea';
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
}

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
  const { action, config, personId } = deps;
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

type BodyBuilder = (values: Record<string, string>) => CommandBody | null;

const BODY_BUILDERS: Partial<Record<CommandAction, BodyBuilder>> = {
  pause: (values) =>
    values.reasonCode ? { reasonCode: values.reasonCode, ...noteOf(values) } : null,
  update: (values) => (values.text ? { text: values.text } : null),
  transfer: (values) => {
    if (!values.note) return null;
    const target = values.toPersonId ? { toPersonId: values.toPersonId } : {};
    return { note: values.note, ...target };
  },
  cancel: (values) => (values.reason ? { reason: values.reason } : null),
  join: (values) =>
    values.role === 'primary' || values.role === 'support' ? { role: values.role } : null,
  leave: (values) => (values.reason ? { reason: values.reason } : null),
};

function buildBody(action: CommandAction, values: Record<string, string>): CommandBody | null {
  return BODY_BUILDERS[action]?.(values) ?? null;
}

interface FieldsProps {
  fields: FieldSpec[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

function FormFields({ fields, values, onChange }: FieldsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => (
        <label key={field.name} className="v2-close-field">
          <span>
            {field.label}
            {field.required ? <span aria-hidden="true"> *</span> : null}
          </span>
          {field.type === 'select' ? (
            <select
              value={values[field.name] ?? ''}
              onChange={(event) => onChange(field.name, event.target.value)}
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
            />
          )}
          {field.hint && <span className="v2-crud-hint">{field.hint}</span>}
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
    <div className="grid grid-cols-2 gap-2">
      <button type="button" className="v2-btn v2-btn-ghost" onClick={onDone}>
        {t('common.back')}
      </button>
      <button type="submit" className="v2-btn v2-btn-primary" disabled={disabled || pending}>
        {pending ? t('common.saving') : submitLabel}
      </button>
    </div>
  );
}

interface Props {
  action: CommandAction;
  personId: string;
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
  cancel: 'action.cancel.title',
};

const SUBMIT_KEYS: Record<string, string> = {
  join: 'action.join.submit',
  leave: 'action.leave.submit',
  pause: 'action.pause.submit',
  update: 'action.update.submit',
  transfer: 'action.transfer.submit',
  cancel: 'action.cancel.submit',
};

/** Join defaults to support; every other form starts empty. */
function initialValues(action: CommandAction): Record<string, string> {
  return action === 'join' ? { role: 'support' } : {};
}

export function ActionForm({ action, personId, config, pending, onRun, onDone }: Props) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(action));
  const fields = fieldsFor(t, { action, config, personId });
  const body = buildBody(action, trimmed(values));
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
    <form onSubmit={submit} aria-label={title} className="v2-card v2-pad">
      <h3 className="v2-h3">{title}</h3>
      <FormFields fields={fields} values={values} onChange={update} />
      <FormActions pending={pending} disabled={!body} submitLabel={submitLabel} onDone={onDone} />
    </form>
  );
}
