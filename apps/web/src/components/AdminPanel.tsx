import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Config, Me, RaiseKind, Ticket } from '../api.js';
import { buildCorrectChanges, hasCorrectChanges } from './correctChanges.js';
import { useCommand } from '../data/index.js';

const inputClass =
  'mt-1 min-h-target w-full rounded-xl border border-control bg-surface px-4 text-body';
const secondaryButton =
  'min-h-target rounded-xl border border-control bg-surface px-4 text-body font-semibold text-neutral-900 [@media(hover:hover)]:hover:bg-neutral-100';
const primaryButton =
  'min-h-target flex-1 rounded-xl bg-accent-strong px-4 text-body font-semibold text-accent-ink disabled:bg-neutral-200 disabled:text-neutral-600 [@media(hover:hover)]:hover:bg-accent-strong/90';

const FIELD = {
  reason: 'reason',
  reportedAt: 'reportedAt',
  startedAt: 'startedAt',
  closedAt: 'closedAt',
  problem: 'problem',
  machineId: 'machineId',
  kind: 'kind',
} as const;

const DATE_FIELDS = [
  { name: FIELD.reportedAt, key: 'admin.reportedAt' },
  { name: FIELD.startedAt, key: 'admin.startedAt' },
  { name: FIELD.closedAt, key: 'admin.closedAt' },
] as const;

const KIND_OPTIONS: { value: RaiseKind; key: string }[] = [
  { value: 'stopped', key: 'admin.kind.stopped' },
  { value: 'support', key: 'admin.kind.support' },
  { value: 'general', key: 'admin.kind.general' },
];

interface InputProps {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'datetime-local';
}

function AdminInput({ name, label, value, onChange, type = 'text' }: InputProps) {
  return (
    <label htmlFor={`admin-${name}`} className="block">
      <span className="text-footnote font-medium text-neutral-600">{label}</span>
      <input
        id={`admin-${name}`}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </label>
  );
}

interface SelectProps {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function AdminSelect({ name, label, value, options, onChange }: SelectProps) {
  const { t } = useTranslation();
  return (
    <label htmlFor={`admin-${name}`} className="block">
      <span className="text-footnote font-medium text-neutral-600">{label}</span>
      <select
        id={`admin-${name}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        <option value="">{t('admin.unchanged')}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface RestoreProps {
  ticket: Ticket;
  onDone: () => void;
}

function RestoreForm({ ticket, onDone }: RestoreProps) {
  const { t } = useTranslation();
  const { run, error, pending } = useCommand();
  const [reason, setReason] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim() || pending) return;
    if (await run(ticket.id, 'restore', { reason: reason.trim() })) onDone();
  }

  return (
    <form
      onSubmit={submit}
      aria-label={t('admin.restore')}
      className="mt-3 rounded-xl bg-neutral-50 p-3"
    >
      <label htmlFor="admin-restore-reason" className="block">
        <span className="text-footnote font-medium text-neutral-600">
          {t('admin.restoreReason')}
        </span>
        <textarea
          id="admin-restore-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={`${inputClass} min-h-24 py-3`}
        />
      </label>
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-danger-tint p-3 text-danger-ink">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onDone} className={`flex-1 ${secondaryButton}`}>
          {t('common.back')}
        </button>
        <button type="submit" disabled={!reason.trim() || pending} className={primaryButton}>
          {pending ? t('common.saving') : t('admin.restoreSubmit')}
        </button>
      </div>
    </form>
  );
}

interface FieldsProps {
  values: Record<string, string>;
  config: Config;
  update: (name: string, value: string) => void;
}

function CorrectFields({ values, config, update }: FieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      {DATE_FIELDS.map((field) => (
        <AdminInput
          key={field.name}
          name={field.name}
          label={t(field.key)}
          type="datetime-local"
          value={values[field.name] ?? ''}
          onChange={(value) => update(field.name, value)}
        />
      ))}
      <AdminInput
        name={FIELD.problem}
        label={t('admin.problem')}
        value={values[FIELD.problem] ?? ''}
        onChange={(value) => update(FIELD.problem, value)}
      />
      <AdminSelect
        name={FIELD.machineId}
        label={t('admin.machine')}
        value={values[FIELD.machineId] ?? ''}
        options={config.machines.map((machine) => ({ value: machine.id, label: machine.code }))}
        onChange={(value) => update(FIELD.machineId, value)}
      />
      <AdminSelect
        name={FIELD.kind}
        label={t('admin.kind')}
        value={values[FIELD.kind] ?? ''}
        options={KIND_OPTIONS.map((option) => ({ value: option.value, label: t(option.key) }))}
        onChange={(value) => update(FIELD.kind, value)}
      />
    </>
  );
}

interface CorrectProps {
  ticket: Ticket;
  config: Config;
  onDone: () => void;
}

function CorrectForm({ ticket, config, onDone }: CorrectProps) {
  const { t } = useTranslation();
  const { run, error, pending } = useCommand();
  const [values, setValues] = useState<Record<string, string>>({});
  const changes = buildCorrectChanges(values);
  const ready = Boolean(values[FIELD.reason]?.trim()) && hasCorrectChanges(changes);

  function update(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || pending) return;
    const reason = values[FIELD.reason]?.trim() ?? '';
    if (await run(ticket.id, 'correct', { reason, changes })) onDone();
  }

  return (
    <form onSubmit={submit} aria-label={t('admin.correct')} className="mt-3 space-y-3">
      <label htmlFor="admin-reason" className="block">
        <span className="text-footnote font-medium text-neutral-600">{t('admin.reason')}</span>
        <textarea
          id="admin-reason"
          value={values[FIELD.reason] ?? ''}
          onChange={(event) => update(FIELD.reason, event.target.value)}
          className={`${inputClass} min-h-24 py-3`}
        />
      </label>
      <CorrectFields values={values} config={config} update={update} />
      <p className="text-caption text-neutral-600">{t('admin.onlyFilled')}</p>
      {!ready && Object.keys(values).length > 1 && (
        <p className="text-caption text-hold-ink">{t('admin.needsReasonAndChange')}</p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-danger-tint p-3 text-danger-ink">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className={`flex-1 ${secondaryButton}`}>
          {t('common.back')}
        </button>
        <button type="submit" disabled={!ready || pending} className={primaryButton}>
          {pending ? t('common.saving') : t('admin.correctSubmit')}
        </button>
      </div>
    </form>
  );
}

interface Props {
  ticket: Ticket;
  config?: Config;
  me?: Me;
}

/** The minimal admin faces for the existing `restore` and `correct` commands; admins only. */
export function AdminPanel({ ticket, config, me }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'restore' | 'correct' | null>(null);
  if (!config || !me || me.role !== 'admin') return null;
  return (
    <section aria-label={t('admin.title')} className="mt-3 rounded-card bg-surface p-4 shadow-card">
      <h2 className="text-footnote font-medium text-neutral-600">{t('admin.title')}</h2>
      {mode === null && (
        <div className="mt-3 flex flex-wrap gap-2">
          {ticket.status === 'cancelled' && (
            <button type="button" onClick={() => setMode('restore')} className={secondaryButton}>
              {t('admin.restore')}
            </button>
          )}
          <button type="button" onClick={() => setMode('correct')} className={secondaryButton}>
            {t('admin.correct')}
          </button>
        </div>
      )}
      {mode === 'restore' && <RestoreForm ticket={ticket} onDone={() => setMode(null)} />}
      {mode === 'correct' && (
        <CorrectForm ticket={ticket} config={config} onDone={() => setMode(null)} />
      )}
    </section>
  );
}
