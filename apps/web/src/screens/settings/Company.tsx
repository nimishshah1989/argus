/* eslint-disable i18next/no-literal-string -- ids and prop values only; every visible string goes through t() */
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getBrand } from '../../api.js';
import { defineResource, putLogo } from '../../data/index.js';
import { PatternFrame } from '../../patterns/frame.js';
import { Button } from '../../ui/button.js';
import { Checkbox, Input, Label, Select } from '../../ui/input.js';
import { Inline, Stack } from '../../ui/layout.js';
import {
  COMPANY_FIELDS,
  companyChanges,
  companySections,
  companyValues,
  storedFeatures,
  type CompanyField,
  type SettingRow,
} from './company-spec.js';

/** `GET /settings` is one array of key/value rows; a save is one `PUT /settings/:key` per changed key. */
const settings = defineResource<SettingRow[]>({ key: 'settings', path: '/api/v1/settings' });

function CompanyFieldRow(p: {
  field: CompanyField;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const { field } = p;
  const id = `company-${field.id}`;
  if (field.kind === 'flag')
    return (
      <Stack gap={1}>
        <Checkbox
          label={t(field.labelKey)}
          checked={p.value === 'true'}
          disabled={p.disabled}
          onChange={(event) => p.onChange(String(event.target.checked))}
        />
        {field.helpKey ? (
          <p className="text-footnote text-neutral-600">{t(field.helpKey)}</p>
        ) : null}
      </Stack>
    );
  return (
    <Stack gap={1}>
      <Label htmlFor={id}>{t(field.labelKey)}</Label>
      {field.kind === 'choice' ? (
        <Select
          id={id}
          value={p.value}
          disabled={p.disabled}
          onChange={(event) => p.onChange(event.target.value)}
        >
          {field.choices?.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {t(choice.labelKey)}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          id={id}
          value={p.value}
          required={field.required}
          disabled={p.disabled}
          onChange={(event) => p.onChange(event.target.value)}
        />
      )}
      {field.helpKey ? <p className="text-footnote text-neutral-600">{t(field.helpKey)}</p> : null}
    </Stack>
  );
}

function LogoControls(p: {
  file: File | null;
  busy: boolean;
  onFile: (file: File | null) => void;
  onUpload: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap={2}>
      <p className="text-footnote text-neutral-600">{t('company.logo.help')}</p>
      <label className="flex min-h-target items-center gap-3 rounded-lg border border-control bg-surface px-3 text-body">
        <input
          type="file"
          aria-label={t('company.logo.choose')}
          accept="image/png,image/jpeg,image/webp"
          className="min-w-0 text-footnote"
          onChange={(event) => p.onFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <Button variant="secondary" disabled={!p.file || p.busy} onClick={p.onUpload}>
        {p.busy ? t('common.sending') : t('company.logo.upload')}
      </Button>
    </Stack>
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
    <Stack gap={2}>
      <h3 className="px-1 text-footnote font-semibold text-neutral-600">{t('company.logo')}</h3>
      <div className="rounded-2xl bg-surface p-4 shadow-card">
        <Stack gap={2}>
          {logo ? (
            <img src={logo} alt={t('company.logo.current')} className="h-16 w-auto self-start" />
          ) : (
            <p className="text-footnote text-neutral-600">{t('company.logo.none')}</p>
          )}
          <LogoControls file={file} busy={busy} onFile={setFile} onUpload={() => void upload()} />
          {note === 'saved' ? (
            <p role="status" className="text-footnote text-ok-ink">
              {t('company.logo.saved')}
            </p>
          ) : null}
          {note === 'failed' ? (
            <p role="alert" className="text-footnote text-danger">
              {t('company.logo.failed')}
            </p>
          ) : null}
        </Stack>
      </div>
    </Stack>
  );
}

function CompanySections(p: {
  values: Record<string, string>;
  disabled: boolean;
  onChange: (id: string, value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {companySections(COMPANY_FIELDS).map((section) => (
        <Stack gap={2} key={section.titleKey}>
          <h3 className="px-1 text-footnote font-semibold text-neutral-600">
            {t(section.titleKey)}
          </h3>
          <div className="rounded-2xl bg-surface p-4 shadow-card">
            <Stack gap={3}>
              {section.fields.map((field) => (
                <CompanyFieldRow
                  key={field.id}
                  field={field}
                  value={p.values[field.id] ?? ''}
                  disabled={p.disabled}
                  onChange={(value) => p.onChange(field.id, value)}
                />
              ))}
            </Stack>
          </div>
        </Stack>
      ))}
    </>
  );
}

function SaveRow(p: {
  busy: boolean;
  missing: boolean;
  changed: boolean;
  saved: boolean;
  failed: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Inline gap={3}>
      <Button type="submit" disabled={p.busy || p.missing || !p.changed}>
        {p.busy ? t('common.sending') : t('company.save')}
      </Button>
      {p.saved ? (
        <p role="status" className="text-footnote text-ok-ink">
          {t('company.saved')}
        </p>
      ) : null}
      {p.failed ? (
        <p role="alert" className="text-footnote text-danger">
          {t('company.error')}
        </p>
      ) : null}
    </Inline>
  );
}

/** The form edits a draft; Save sends one PUT per changed key and then drops the draft. */
function CompanyForm({ rows }: { rows: SettingRow[] }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const stored = companyValues(rows);
  const features = storedFeatures(rows);
  const values = draft ?? stored;
  const changes = draft ? companyChanges(stored, draft, features) : [];
  const missing = COMPANY_FIELDS.some(
    (field) => field.required && (values[field.id] ?? '').trim() === '',
  );

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setFailed(false);
    try {
      for (const change of changes) await settings.update(change.key, { value: change.value });
      setDraft(null);
      setSaved(true);
      await Promise.all(
        ['settings', 'config', 'brand'].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form aria-label={t('company.title')} onSubmit={(event) => void save(event)}>
      <Stack gap={4}>
        <CompanySections
          values={values}
          disabled={busy}
          onChange={(id, value) => {
            setSaved(false);
            setDraft({ ...values, [id]: value });
          }}
        />
        <LogoSection />
        <SaveRow
          busy={busy}
          missing={missing}
          changed={changes.length > 0}
          saved={saved}
          failed={failed}
        />
      </Stack>
    </form>
  );
}

/** Company settings (ticket 23): name, language, time zone and the feature switches, from one config. */
export function CompanyScreen() {
  const { t } = useTranslation();
  const rows = useQuery({ queryKey: ['settings'], queryFn: () => settings.one() });
  return (
    <PatternFrame title={t('company.title')}>
      <p className="text-footnote text-neutral-600">{t('company.intro')}</p>
      {rows.isLoading ? <p className="text-neutral-600">{t('common.loading')}</p> : null}
      {rows.error ? (
        <p role="alert" className="text-body font-medium text-neutral-900">
          {t('company.error')}
        </p>
      ) : null}
      {rows.data ? <CompanyForm rows={rows.data} /> : null}
    </PatternFrame>
  );
}
