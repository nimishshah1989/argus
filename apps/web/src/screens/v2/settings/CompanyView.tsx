import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getBrand } from '../../../api.js';
import { defineResource, putLogo, useOnline } from '../../../data/index.js';
import { Button } from '../../../ui/v2/button.js';
import { Panel } from '../../../ui/v2/panel.js';
import { ErrorState, OfflineState, Skeleton } from '../../../ui/v2/screen-states.js';
import {
  COMPANY_FIELDS,
  companyChanges,
  companySections,
  companyValues,
  storedFeatures,
  type CompanyField,
  type SettingRow,
} from '../../settings/company-spec.js';
import { SaveNote } from './save-note.js';

/** `GET /settings` is one array of key/value rows; a save is one `PUT /settings/:key` per changed key. */
const settings = defineResource<SettingRow[]>({ key: 'settings', path: '/api/v1/settings' });

function Help({ field }: { field: CompanyField }) {
  const { t } = useTranslation();
  return field.helpKey ? <span className="v2-crud-sub">{t(field.helpKey)}</span> : null;
}

/** One setting: a switch is a checkbox, a choice a menu, the rest a text box; each with its help line. */
function CompanyFieldRow(p: {
  field: CompanyField;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const { field } = p;
  if (field.kind === 'flag')
    return (
      <div>
        <label className="v2-target">
          <input
            type="checkbox"
            checked={p.value === 'true'}
            disabled={p.disabled}
            onChange={(e) => p.onChange(String(e.target.checked))}
          />
          {t(field.labelKey)}
        </label>
        <Help field={field} />
      </div>
    );
  if (field.kind === 'choice')
    return (
      <div className="v2-crud-field">
        <label className="v2-select-field">
          {t(field.labelKey)}
          <select
            value={p.value}
            disabled={p.disabled}
            onChange={(e) => p.onChange(e.target.value)}
          >
            {field.choices?.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {t(choice.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <Help field={field} />
      </div>
    );
  return (
    <label className="v2-crud-field">
      {t(field.labelKey)}
      <input
        value={p.value}
        required={field.required}
        disabled={p.disabled}
        onChange={(e) => p.onChange(e.target.value)}
      />
      <Help field={field} />
    </label>
  );
}

/** The logo is its own route: the bytes go up as they are and the reply names the stored file. */
function LogoSection() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const brand = useQuery({ queryKey: ['brand'], queryFn: getBrand, retry: false });
  const logo = brand.data?.logo ?? null;
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<'saved' | 'failed' | null>(null);

  async function upload(): Promise<void> {
    if (!file) return;
    setBusy(true);
    setNote(null);
    try {
      await putLogo(file);
      await client.invalidateQueries({ queryKey: ['brand'] });
      setNote('saved');
      setFile(null);
    } catch {
      setNote('failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={t('company.logo')} sub={t('company.logo.help')}>
      <div className="v2-crud-form">
        {logo ? (
          <img src={logo} alt={t('company.logo.current')} className="v2-crud-logo" />
        ) : (
          <p className="v2-crud-hint">{t('company.logo.none')}</p>
        )}
        <input
          type="file"
          aria-label={t('company.logo.choose')}
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="v2-crud-actions">
          <Button disabled={!file || busy} onClick={() => void upload()}>
            {busy ? t('common.sending') : t('company.logo.upload')}
          </Button>
        </div>
        <SaveNote note={note} saved={t('company.logo.saved')} failed={t('company.logo.failed')} />
      </div>
    </Panel>
  );
}

/** The details and the switches, each group a card, from the one config. */
function CompanySections(p: {
  values: Record<string, string>;
  disabled: boolean;
  onChange: (id: string, value: string) => void;
}) {
  const { t } = useTranslation();
  return companySections(COMPANY_FIELDS).map((section) => (
    <Panel key={section.titleKey} title={t(section.titleKey)}>
      <div className="v2-crud-form">
        {section.fields.map((field) => (
          <CompanyFieldRow
            key={field.id}
            field={field}
            value={p.values[field.id] ?? ''}
            disabled={p.disabled}
            onChange={(value) => p.onChange(field.id, value)}
          />
        ))}
      </div>
    </Panel>
  ));
}

/** The form edits a draft; Save sends one PUT per changed key and then drops the draft. */
function CompanyForm({ rows }: { rows: SettingRow[] }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<'saved' | 'failed' | null>(null);
  const stored = companyValues(rows);
  const features = storedFeatures(rows);
  const values = draft ?? stored;
  const changes = draft ? companyChanges(stored, draft, features) : [];
  const missing = COMPANY_FIELDS.some(
    (field) => field.required && (values[field.id] ?? '').trim() === '',
  );

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || missing || changes.length === 0) return;
    setBusy(true);
    setNote(null);
    try {
      for (const change of changes) await settings.update(change.key, { value: change.value });
      setDraft(null);
      setNote('saved');
      await Promise.all(
        ['settings', 'config', 'brand'].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    } catch {
      setNote('failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="v2-crud"
      aria-label={t('company.title')}
      onSubmit={(event) => void save(event)}
    >
      <CompanySections
        values={values}
        disabled={busy}
        onChange={(id, value) => {
          setNote(null);
          setDraft({ ...values, [id]: value });
        }}
      />
      <LogoSection />
      <div className="v2-crud-actions">
        <button
          type="submit"
          className="v2-btn v2-btn-primary"
          disabled={busy || missing || changes.length === 0}
        >
          {busy ? t('common.sending') : t('company.save')}
        </button>
      </div>
      <SaveNote note={note} saved={t('company.saved')} failed={t('company.error')} />
    </form>
  );
}

/** Company settings (S26, ticket 794): name, language, time zone, the feature switches and the logo, on the kit. */
export function CompanyView() {
  const { t } = useTranslation();
  const online = useOnline();
  const rows = useQuery({ queryKey: ['settings'], queryFn: () => settings.one() });
  const retry = () => void rows.refetch();
  return (
    <div className="v2-crud">
      <h2 className="v2-h2">{t('company.title')}</h2>
      <p className="v2-crud-hint">{t('company.intro')}</p>
      {rows.data ? (
        <CompanyForm rows={rows.data} />
      ) : rows.isError ? (
        online ? (
          <ErrorState onRetry={retry} />
        ) : (
          <OfflineState onRetry={retry} />
        )
      ) : (
        <Skeleton />
      )}
    </div>
  );
}
