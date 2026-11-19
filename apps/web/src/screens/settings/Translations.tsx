import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { defineResource } from '../../data/index.js';
import i18n, { applyOverrides, setLanguage } from '../../i18n/index.js';
import { PatternFrame } from '../../patterns/frame.js';
import { Button } from '../../ui/button.js';
import { Card } from '../../ui/card.js';
import { Input, Label } from '../../ui/input.js';
import { Inline, Stack } from '../../ui/layout.js';
import {
  OVERRIDES_KEY,
  missingTranslations,
  savedOverrides,
  searchTranslations,
  storedOverrides,
  type SettingRow,
  type TranslationRow,
} from './translations-spec.js';

/** `GET /settings` is one array of key/value rows; every override saves as one `PUT /settings/:key` (D17). */
const settings = defineResource<SettingRow[]>({ key: 'settings', path: '/api/v1/settings' });

function fieldId(key: string): string {
  return `translation-${key.replace(/[^a-zA-Z0-9]+/g, '-')}`;
}

function TranslationField(p: {
  row: TranslationRow;
  value: string;
  disabled: boolean;
  onChange: (text: string) => void;
}) {
  const id = fieldId(p.row.key);
  return (
    <Card>
      <Stack gap={1}>
        <p className="text-caption text-neutral-600">{p.row.key}</p>
        <Label htmlFor={id}>{p.row.en}</Label>
        <Input
          id={id}
          value={p.value}
          disabled={p.disabled}
          onChange={(event) => p.onChange(event.target.value)}
        />
      </Stack>
    </Card>
  );
}

/** One primary action: save the whole map, with its own status line. */
function SaveRow(p: {
  busy: boolean;
  canSave: boolean;
  note: 'saved' | 'failed' | null;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Inline gap={3}>
      <Button onClick={p.onSave} disabled={p.busy || !p.canSave}>
        {p.busy ? t('common.sending') : t('plant.translations.save')}
      </Button>
      {p.note === 'saved' ? (
        <p role="status" className="text-footnote text-ok-ink">
          {t('plant.translations.saved')}
        </p>
      ) : null}
      {p.note === 'failed' ? (
        <p role="alert" className="text-footnote text-danger">
          {t('plant.translations.error')}
        </p>
      ) : null}
    </Inline>
  );
}

function TranslationList(p: {
  rows: TranslationRow[];
  drafts: Record<string, string>;
  disabled: boolean;
  onChange: (key: string, text: string) => void;
}) {
  return (
    <Stack gap={2}>
      {p.rows.map((row) => (
        <TranslationField
          key={row.key}
          row={row}
          value={p.drafts[row.key] ?? ''}
          disabled={p.disabled}
          onChange={(text) => p.onChange(row.key, text)}
        />
      ))}
    </Stack>
  );
}

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

/** The admin types Gujarati; one save writes the whole map, and the app shows it without a reload. */
function TranslationForm({ rows }: { rows: SettingRow[] }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { stored, drafts, busy, note, save, draft } = useOverrides(rows);
  const missing = missingTranslations(stored);
  const shown = searchTranslations(missing, search);

  return (
    <Stack gap={3}>
      <p className="text-footnote text-neutral-600">{t('plant.translations.intro')}</p>
      <Stack gap={1}>
        <Label htmlFor="translation-search">{t('plant.translations.search')}</Label>
        <Input
          id="translation-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Stack>
      <p className="text-body font-semibold">
        {t('plant.translations.count', { count: missing.length })}
      </p>
      <SaveRow
        busy={busy}
        canSave={Object.keys(drafts).length > 0}
        note={note}
        onSave={() => void save()}
      />
      {shown.length === 0 ? (
        <p className="text-body text-neutral-600">
          {missing.length === 0 ? t('plant.translations.empty') : t('plant.translations.noMatch')}
        </p>
      ) : (
        <TranslationList rows={shown} drafts={drafts} disabled={busy} onChange={draft} />
      )}
    </Stack>
  );
}

/** Settings → Translations (ticket 24): the keys with no Gujarati yet, edited into the plant's own overrides. */
export function TranslationsScreen() {
  const { t } = useTranslation();
  const rows = useQuery({ queryKey: ['settings'], queryFn: () => settings.one() });
  return (
    <PatternFrame title={t('plant.translations.title')}>
      {rows.isLoading ? <p className="text-neutral-600">{t('common.loading')}</p> : null}
      {rows.error ? (
        <p role="alert" className="text-body font-medium text-neutral-900">
          {t('plant.translations.error')}
        </p>
      ) : null}
      {rows.data ? <TranslationForm rows={rows.data} /> : null}
    </PatternFrame>
  );
}
