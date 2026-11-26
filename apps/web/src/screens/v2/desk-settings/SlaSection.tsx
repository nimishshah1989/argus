/* eslint-disable i18next/no-literal-string -- severity codes, ids, routes and units only; every visible word goes through t() */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getConfig, putSlaPolicies, type Severity, type SlaPolicy } from '../../../api.js';
import { invalidateSlaData } from '../../../components/slaQueries.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { pausingReasons, slaRows } from './model.js';

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

/** "4 h" when the minutes are whole hours, else "270 min". */
const duration = (minutes: number): string =>
  minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;

function usePolicyDraft(policies: SlaPolicy[] | undefined) {
  const [drafts, setDrafts] = useState<Drafts>(() => makeDrafts(policies ?? []));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!dirty) setDrafts(makeDrafts(policies ?? []));
  }, [dirty, policies]);
  function change(severity: Severity, patch: Partial<PolicyDraft>): void {
    setDirty(true);
    setSaved(false);
    setDrafts((current) => ({ ...current, [severity]: { ...current[severity], ...patch } }));
  }
  const valid = SEVERITIES.every(
    (s) => positiveInteger(drafts[s].ackMinutes) && positiveInteger(drafts[s].restoreMinutes),
  );
  return { drafts, dirty, valid, saved, change, setDirty, setSaved };
}

/** The S1 row's targets in a line, the way a reader says them. */
function SlaTakeaway({ policies }: { policies: SlaPolicy[] }) {
  const { t } = useTranslation();
  const high = slaRows(policies)[0];
  if (!high || high.severity !== 'S1') return null;
  return (
    <Takeaway
      data={{
        text: t('deskSettings.sla.takeaway', {
          ack: high.ackMinutes,
          restore: duration(high.restoreMinutes),
        }),
        tone: 'neutral',
        tag: high.severity,
      }}
    />
  );
}

function PolicyFieldset(props: {
  severity: Severity;
  draft: PolicyDraft;
  longest: number;
  disabled: boolean;
  onChange: (severity: Severity, patch: Partial<PolicyDraft>) => void;
}) {
  const { t } = useTranslation();
  const { severity, draft, longest, disabled, onChange } = props;
  const fields: [MinuteField, string][] = [
    ['ackMinutes', t('settings.slaAckMinutes')],
    ['restoreMinutes', t('settings.slaRestoreMinutes')],
  ];
  return (
    <fieldset disabled={disabled}>
      <legend>{severity}</legend>
      {fields.map(([field, label]) => (
        <label key={field}>
          {label}
          <input
            className="v2-target"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            required
            value={draft[field]}
            onChange={(e) => onChange(severity, { [field]: e.target.value })}
          />
          <meter
            aria-hidden
            min={0}
            max={Math.max(longest, 1)}
            value={positiveInteger(draft[field]) ? Number(draft[field]) : 0}
          />
        </label>
      ))}
      <label className="v2-target">
        <input
          type="checkbox"
          checked={draft.businessHoursOnly}
          onChange={(e) => onChange(severity, { businessHoursOnly: e.target.checked })}
        />
        {t('settings.slaBusinessHours')}
      </label>
    </fieldset>
  );
}

function usePolicySave(online: boolean, draft: ReturnType<typeof usePolicyDraft>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(): Promise<void> {
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
  return { saving, error, save };
}

function PolicyForm({ policies, online }: { policies: SlaPolicy[]; online: boolean }) {
  const { t } = useTranslation();
  const draft = usePolicyDraft(policies);
  const { saving, error, save } = usePolicySave(online, draft);
  const longest = Math.max(0, ...policies.map((p) => p.restoreMinutes));
  return (
    <section className="v2-card">
      <h2 className="v2-h3">{t('settings.slaTitle')}</h2>
      <p>{t('settings.slaHelp')}</p>
      <SlaTakeaway policies={policies} />
      {policies.length === 0 ? <p>{t('settings.slaEmpty')}</p> : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {SEVERITIES.map((severity) => (
          <PolicyFieldset
            key={severity}
            severity={severity}
            draft={draft.drafts[severity]}
            longest={longest}
            disabled={!online || saving}
            onChange={draft.change}
          />
        ))}
        <button
          type="submit"
          className="v2-btn v2-btn-primary v2-target"
          disabled={!online || saving || !draft.dirty || !draft.valid}
        >
          {saving ? t('common.saving') : t('settings.slaSave')}
        </button>
        {draft.saved ? (
          <p role="status">
            <KeyPill text={t('settings.slaSaved')} tone="gain" icon="check" />
          </p>
        ) : null}
        {error ? (
          <p role="alert">
            <KeyPill text={error} tone="loss" icon="alert" />
          </p>
        ) : null}
      </form>
    </section>
  );
}

/** Restore clock pauses: which active wait reasons stop the clock. Read-only; the flag is edited in Lists. */
function PausesSection() {
  const { t } = useTranslation();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const { pausing, total } = pausingReasons(config.data?.lists.wait_reason ?? []);
  return (
    <section className="v2-card">
      <h2 className="v2-h3">{t('settings.waitSlaTitle')}</h2>
      <p>{t('settings.waitSlaHelp')}</p>
      {total === 0 ? (
        <p>{t('settings.waitSlaEmpty')}</p>
      ) : (
        <>
          <Takeaway
            data={{
              text: t('deskSettings.pauses.takeaway', { pausing: pausing.length, total }),
              tone: 'neutral',
              tag: t('settings.waitSlaTitle'),
            }}
          />
          <ul className="v2-stack">
            {pausing.map((r) => (
              <li key={r.id}>{r.label}</li>
            ))}
          </ul>
        </>
      )}
      <Link to="/settings/lists?list=wait_reason" className="v2-link">
        {t('deskSettings.pauses.link')}
      </Link>
    </section>
  );
}

/** SLA policies and Restore clock pauses (S26-8). */
export function SlaSections({ online }: { online: boolean }) {
  const { t } = useTranslation();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const policies = config.data?.slaPolicies;
  return (
    <>
      {policies ? (
        <PolicyForm policies={policies} online={online} />
      ) : (
        <section className="v2-card">
          <h2 className="v2-h3">{t('settings.slaTitle')}</h2>
          <p>{t('settings.slaUnavailable')}</p>
        </section>
      )}
      <PausesSection />
    </>
  );
}
