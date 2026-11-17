import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getConfig, putSlaPolicies, type Severity, type SlaPolicy } from '../api.js';
import { invalidateSlaData } from './slaQueries.js';

const SEVERITIES: Severity[] = ['S1', 'S2', 'S3', 'S4'];
type MinuteField = 'ackMinutes' | 'restoreMinutes';
interface PolicyDraft {
  ackMinutes: string;
  restoreMinutes: string;
  businessHoursOnly: boolean;
}
type Drafts = Record<Severity, PolicyDraft>;

function makeDrafts(policies: SlaPolicy[]): Drafts {
  const rows = new Map(policies.map((policy) => [policy.severity, policy]));
  return Object.fromEntries(
    SEVERITIES.map((severity) => {
      const policy = rows.get(severity);
      return [
        severity,
        {
          ackMinutes: policy?.ackMinutes.toString() ?? '',
          restoreMinutes: policy?.restoreMinutes.toString() ?? '',
          businessHoursOnly: policy?.businessHoursOnly ?? false,
        },
      ];
    }),
  ) as Drafts;
}

function positiveInteger(value: string): boolean {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

function usePolicyDraft(policies: SlaPolicy[] | undefined) {
  const [drafts, setDrafts] = useState<Drafts>(() => makeDrafts(policies ?? []));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!dirty) setDrafts(makeDrafts(policies ?? []));
  }, [dirty, policies]);
  function edit(): void {
    setDirty(true);
    setSaved(false);
  }
  function onMinute(severity: Severity, field: MinuteField, value: string): void {
    edit();
    setDrafts((current) => ({
      ...current,
      [severity]: { ...current[severity], [field]: value },
    }));
  }
  function onBusiness(severity: Severity, value: boolean): void {
    edit();
    setDrafts((current) => ({
      ...current,
      [severity]: { ...current[severity], businessHoursOnly: value },
    }));
  }
  const valid = SEVERITIES.every(
    (severity) =>
      positiveInteger(drafts[severity].ackMinutes) &&
      positiveInteger(drafts[severity].restoreMinutes),
  );
  return { drafts, dirty, valid, saved, onMinute, onBusiness, setDirty, setSaved };
}

interface FieldsetProps {
  severity: Severity;
  draft: PolicyDraft;
  disabled: boolean;
  onMinute: (severity: Severity, field: MinuteField, value: string) => void;
  onBusiness: (severity: Severity, value: boolean) => void;
}

function PolicyFieldset({ severity, draft, disabled, onMinute, onBusiness }: FieldsetProps) {
  const { t } = useTranslation();
  const fields = [
    ['ackMinutes', t('settings.slaAckMinutes')],
    ['restoreMinutes', t('settings.slaRestoreMinutes')],
  ] as const;
  return (
    <fieldset className="rounded-xl border border-neutral-200 p-3" disabled={disabled}>
      <legend className="px-1 text-base font-semibold">{severity}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([field, label]) => (
          <label key={field} className="text-sm font-medium text-neutral-700">
            {label}
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              required
              value={draft[field]}
              onChange={(event) => onMinute(severity, field, event.target.value)}
              className="mt-1 min-h-13 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base text-neutral-900 disabled:opacity-60"
            />
          </label>
        ))}
      </div>
      <label className="mt-2 flex min-h-13 items-center gap-3 rounded-lg px-1 text-base text-neutral-800">
        <input
          type="checkbox"
          checked={draft.businessHoursOnly}
          onChange={(event) => onBusiness(severity, event.target.checked)}
          className="h-5 w-5 accent-accent"
        />
        {t('settings.slaBusinessHours')}
      </label>
    </fieldset>
  );
}

interface PolicyFormProps {
  policies: SlaPolicy[];
  online: boolean;
  draft: ReturnType<typeof usePolicyDraft>;
  saving: boolean;
  error: string | null;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}

function PolicyForm({ policies, online, draft, saving, error, onSave }: PolicyFormProps) {
  const { t } = useTranslation();
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">{t('settings.slaTitle')}</h2>
      <p className="mt-1 text-sm text-neutral-600">{t('settings.slaHelp')}</p>
      {policies.length === 0 && (
        <p className="mt-3 text-sm text-neutral-700">{t('settings.slaEmpty')}</p>
      )}
      <form onSubmit={onSave}>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {SEVERITIES.map((severity) => (
            <PolicyFieldset
              key={severity}
              severity={severity}
              draft={draft.drafts[severity]}
              disabled={!online || saving}
              onMinute={draft.onMinute}
              onBusiness={draft.onBusiness}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!online || saving || !draft.dirty || !draft.valid}
            className="min-h-13 rounded-xl bg-neutral-900 px-5 text-base font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {saving ? t('common.saving') : t('settings.slaSave')}
          </button>
          {draft.saved && (
            <p role="status" className="text-sm font-medium text-green-800">
              {t('settings.slaSaved')}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

function SlaPolicySection({ policies, online }: { policies?: SlaPolicy[]; online: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const draft = usePolicyDraft(policies);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!online || !draft.valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await putSlaPolicies({
        policies: SEVERITIES.map((severity) => ({
          severity,
          ackMinutes: Number(draft.drafts[severity].ackMinutes),
          restoreMinutes: Number(draft.drafts[severity].restoreMinutes),
          businessHoursOnly: draft.drafts[severity].businessHoursOnly,
        })),
      });
      draft.setDirty(false);
      draft.setSaved(true);
      await invalidateSlaData(queryClient);
    } catch {
      setError(t('settings.slaSaveFailed'));
    } finally {
      setSaving(false);
    }
  }
  if (!policies) {
    return (
      <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-neutral-600">{t('settings.slaTitle')}</h2>
        <p className="mt-2 text-neutral-600">{t('settings.slaUnavailable')}</p>
      </section>
    );
  }
  return (
    <PolicyForm
      policies={policies}
      online={online}
      draft={draft}
      saving={saving}
      error={error}
      onSave={save}
    />
  );
}

export function SlaSettingsSections({ online }: { online: boolean }) {
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  return <SlaPolicySection policies={config.data?.slaPolicies} online={online} />;
}
