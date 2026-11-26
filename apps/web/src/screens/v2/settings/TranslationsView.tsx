/* eslint-disable i18next/no-literal-string -- ids and prop values only; every visible word goes through t() */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { en } from '@uptimo/shared/i18n';
import { defineResource, useOnline } from '../../../data/index.js';
import i18n, { applyOverrides, setLanguage } from '../../../i18n/index.js';
import { Button } from '../../../ui/v2/button.js';
import { ErrorState, OfflineState, Skeleton } from '../../../ui/v2/screen-states.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import {
  OVERRIDES_KEY,
  missingTranslations,
  savedOverrides,
  searchTranslations,
  storedOverrides,
  type SettingRow,
  type TranslationRow,
} from '../../settings/translations-spec.js';
import { SaveNote } from './save-note.js';

/** `GET /settings` is one array of key/value rows; every override saves as one `PUT /settings/:key` (D17). */
const settings = defineResource<SettingRow[]>({ key: 'settings', path: '/api/v1/settings' });
/** Rows drawn before "n more keys"; the rest open on a press, so a long list never draws a thousand boxes at once. */
const FIRST = 50;
const pct = (n: number, total: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

/** The draft and its one save: the stored map plus what the admin typed, written as one setting. */
function useOverrides(rows: SettingRow[]) {
  const client = useQueryClient();
  const [saved, setSaved] = useState<Record<string, string> | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<'saved' | 'failed' | null>(null);
  const stored = saved ?? storedOverrides(rows);

  async function save(): Promise<void> {
    setBusy(true);
    setNote(null);
    const next = savedOverrides(stored, drafts);
    try {
      await settings.update(OVERRIDES_KEY, { value: next });
      setSaved(next);
      setDrafts({});
      applyOverrides(next);
      // The app is already showing Gujarati: re-running the language swaps the bundle just laid over it.
      await setLanguage(i18n.language === 'gu' ? 'gu' : 'en');
      setNote('saved');
      await Promise.all(
        ['settings', 'config'].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    } catch {
      setNote('failed');
    } finally {
      setBusy(false);
    }
  }

  function draft(key: string, text: string): void {
    setNote(null);
    setDrafts({ ...drafts, [key]: text });
  }

  return { stored, drafts, busy, note, save, draft };
}

/** Key, its English, and a box for the Gujarati, labelled by the English it replaces. */
function TranslationTable(p: {
  rows: TranslationRow[];
  drafts: Record<string, string>;
  disabled: boolean;
  onChange: (key: string, text: string) => void;
}) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const drawn = all ? p.rows : p.rows.slice(0, FIRST);
  return (
    <section className="v2-card v2-table-card" aria-label={t('plant.translations.table')}>
      <div className="v2-table-bar">
        <h2 className="v2-h2">{t('plant.translations.table')}</h2>
      </div>
      <div className="v2-table-scroll">
        <table className="v2-table">
          <thead>
            <tr>
              <th scope="col">{t('plant.translations.col.key')}</th>
              <th scope="col">{t('plant.translations.col.en')}</th>
              <th scope="col">{t('plant.translations.col.gu')}</th>
            </tr>
          </thead>
          <tbody>
            {drawn.map((row) => (
              <tr key={row.key}>
                <td>{row.key}</td>
                <td>{row.en}</td>
                <td className="v2-crud-field">
                  <input
                    aria-label={row.en}
                    value={p.drafts[row.key] ?? ''}
                    disabled={p.disabled}
                    onChange={(e) => p.onChange(row.key, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {drawn.length < p.rows.length ? (
        <Button onClick={() => setAll(true)}>
          {t('plant.translations.more', { count: p.rows.length - drawn.length })}
        </Button>
      ) : null}
    </section>
  );
}

/** How much has Gujarati: the takeaway and a bar; nothing once every key has it. */
function Lead({ missing }: { missing: number }) {
  const { t } = useTranslation();
  const total = Object.keys(en).length;
  const done = pct(total - missing, total);
  if (missing === 0) return null;
  return (
    <>
      <Takeaway
        data={{
          text: t('plant.translations.takeaway', {
            n: missing,
            total,
            pct: pct(missing, total),
            done,
          }),
          tone: 'risk',
          tag: t('plant.translations.missing', { count: missing }),
        }}
      />
      <div
        className="v2-kpi-meter"
        role="progressbar"
        aria-label={t('plant.translations.progress', { pct: done })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={done}
      >
        <span style={{ width: `${done}%` }} />
      </div>
    </>
  );
}

/** The admin types Gujarati; one save writes the whole map, and the app shows it without a reload. */
function TranslationForm({ rows }: { rows: SettingRow[] }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { stored, drafts, busy, note, save, draft } = useOverrides(rows);
  const missing = missingTranslations(stored);
  const shown = searchTranslations(missing, search);

  return (
    <>
      <Lead missing={missing.length} />
      <label className="v2-crud-field">
        {t('plant.translations.search')}
        <input id="translation-search" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <p className="v2-crud-hint">{t('plant.translations.count', { count: missing.length })}</p>
      <div className="v2-crud-actions">
        <Button
          primary
          disabled={busy || Object.keys(drafts).length === 0}
          onClick={() => void save()}
        >
          {busy ? t('common.sending') : t('plant.translations.save')}
        </Button>
      </div>
      <SaveNote
        note={note}
        saved={t('plant.translations.saved')}
        failed={t('plant.translations.error')}
      />
      {shown.length === 0 ? (
        <p className="v2-crud-hint">
          {missing.length === 0 ? t('plant.translations.empty') : t('plant.translations.noMatch')}
        </p>
      ) : (
        <TranslationTable
          key={search}
          rows={shown}
          drafts={drafts}
          disabled={busy}
          onChange={draft}
        />
      )}
    </>
  );
}

/** Settings → Translations (S26, ticket 794): the keys with no Gujarati yet, edited into the plant's own overrides. */
export function TranslationsView() {
  const { t } = useTranslation();
  const online = useOnline();
  const rows = useQuery({ queryKey: ['settings'], queryFn: () => settings.one() });
  const retry = () => void rows.refetch();
  return (
    <div className="v2-crud">
      <h2 className="v2-h2">{t('plant.translations.title')}</h2>
      <p className="v2-crud-hint">{t('plant.translations.intro')}</p>
      {rows.data ? (
        <TranslationForm rows={rows.data} />
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
