/* eslint-disable i18next/no-literal-string -- field names, input types and notice tones only; every visible word goes through t() */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Config, Me, RaiseKind, Ticket } from '../../../../api.js';
import { buildCorrectChanges, hasCorrectChanges } from '../../../../components/correctChanges.js';
import { useCommand } from '../../../../data/index.js';
import { Button } from '../../../../ui/v2/button.js';
import { ChoiceField, Field } from '../../../../ui/v2/close-kit.js';
import { Notice } from '../../../../ui/v2/notice.js';
import { Panel } from '../../../../ui/v2/panel.js';

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

/** Back, then the form's one primary button (a real submit). */
function FormButtons({
  ready,
  pending,
  submit,
  onDone,
}: {
  ready: boolean;
  pending: boolean;
  submit: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="v2-ticket-buttons">
      <Button onClick={onDone}>{t('common.back')}</Button>
      <button type="submit" disabled={!ready || pending} className="v2-btn v2-btn-primary">
        {pending ? t('common.saving') : submit}
      </button>
    </div>
  );
}

function Failure({ error }: { error: string | null }) {
  return error ? <Notice tone="loss" title={error} /> : null;
}

function RestoreForm({ ticket, onDone }: { ticket: Ticket; onDone: () => void }) {
  const { t } = useTranslation();
  const { run, error, pending } = useCommand();
  const [reason, setReason] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim() || pending) return;
    if (await run(ticket.id, 'restore', { reason: reason.trim() })) onDone();
  }

  return (
    <form onSubmit={submit} aria-label={t('admin.restore')} className="v2-stack v2-ticket-gap">
      <Field id="admin-restore-reason" label={t('admin.restoreReason')}>
        <textarea
          id="admin-restore-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <Failure error={error} />
      <FormButtons
        ready={Boolean(reason.trim())}
        pending={pending}
        submit={t('admin.restoreSubmit')}
        onDone={onDone}
      />
    </form>
  );
}

function CorrectFields({
  values,
  config,
  update,
}: {
  values: Record<string, string>;
  config: Config;
  update: (name: string, value: string) => void;
}) {
  const { t } = useTranslation();
  const input = (name: string, label: string, type: 'text' | 'datetime-local' = 'text') => (
    <Field key={name} id={`admin-${name}`} label={label}>
      <input
        id={`admin-${name}`}
        type={type}
        value={values[name] ?? ''}
        onChange={(event) => update(name, event.target.value)}
      />
    </Field>
  );
  return (
    <>
      {DATE_FIELDS.map((field) => input(field.name, t(field.key), 'datetime-local'))}
      {input(FIELD.problem, t('admin.problem'))}
      <ChoiceField
        id={`admin-${FIELD.machineId}`}
        label={t('admin.machine')}
        value={values[FIELD.machineId] ?? ''}
        empty={t('admin.unchanged')}
        options={config.machines.map((machine) => ({ value: machine.id, label: machine.code }))}
        onChange={(value) => update(FIELD.machineId, value)}
      />
      <ChoiceField
        id={`admin-${FIELD.kind}`}
        label={t('admin.kind')}
        value={values[FIELD.kind] ?? ''}
        empty={t('admin.unchanged')}
        options={KIND_OPTIONS.map((option) => ({ value: option.value, label: t(option.key) }))}
        onChange={(value) => update(FIELD.kind, value)}
      />
    </>
  );
}

function CorrectForm({
  ticket,
  config,
  onDone,
}: {
  ticket: Ticket;
  config: Config;
  onDone: () => void;
}) {
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
    <form onSubmit={submit} aria-label={t('admin.correct')} className="v2-stack v2-ticket-gap">
      <Field id="admin-reason" label={t('admin.reason')}>
        <textarea
          id="admin-reason"
          value={values[FIELD.reason] ?? ''}
          onChange={(event) => update(FIELD.reason, event.target.value)}
        />
      </Field>
      <CorrectFields values={values} config={config} update={update} />
      <p className="v2-sub">{t('admin.onlyFilled')}</p>
      {!ready && Object.keys(values).length > 1 ? (
        <p className="v2-sub v2-ticket-warn">{t('admin.needsReasonAndChange')}</p>
      ) : null}
      <Failure error={error} />
      <FormButtons
        ready={ready}
        pending={pending}
        submit={t('admin.correctSubmit')}
        onDone={onDone}
      />
    </form>
  );
}

/** The admin faces for the existing `restore` and `correct` commands (v1 `AdminPanel`); admins only. */
export function AdminCard({ ticket, config, me }: { ticket: Ticket; config?: Config; me?: Me }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'restore' | 'correct' | null>(null);
  if (!config || !me || me.role !== 'admin') return null;
  return (
    <Panel title={t('admin.title')}>
      {mode === null ? (
        <div className="v2-ticket-buttons">
          {ticket.status === 'cancelled' ? (
            <Button onClick={() => setMode('restore')}>{t('admin.restore')}</Button>
          ) : null}
          <Button onClick={() => setMode('correct')}>{t('admin.correct')}</Button>
        </div>
      ) : null}
      {mode === 'restore' ? <RestoreForm ticket={ticket} onDone={() => setMode(null)} /> : null}
      {mode === 'correct' ? (
        <CorrectForm ticket={ticket} config={config} onDone={() => setMode(null)} />
      ) : null}
    </Panel>
  );
}
