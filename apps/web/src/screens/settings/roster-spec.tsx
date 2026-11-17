import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { rosterReplySchema, type RosterReply } from '@uptimo/shared/escalation-settings';
import type { PersonAdmin } from '@uptimo/shared/people';
import type { ShiftReply } from '@uptimo/shared/plant-settings';
import { ApiError, copyRoster, getConfig } from '../../api.js';
import { CrudPage } from '../../patterns/crud-page.js';
import type { CrudChoice, CrudCtx, CrudSpec, LabelKey } from '../../patterns/crud-spec.js';
import { Button } from '../../ui/button.js';
import { Input, Label } from '../../ui/input.js';
import { Inline, Stack } from '../../ui/layout.js';

/** The duty roster (ticket 31): one line per person, day, shift and rung of the ladder. */

const rowsOf = <T,>(c: CrudCtx, name: string) => c.lookups[name] as T[];
const LEVELS: readonly RosterReply['level'][] = ['L1', 'L2', 'L3', 'L4', 'vendor'];
const LEVEL_KEY: Record<RosterReply['level'], LabelKey> = {
  L1: 'plant.roster.level.L1',
  L2: 'plant.roster.level.L2',
  L3: 'plant.roster.level.L3',
  L4: 'plant.roster.level.L4',
  vendor: 'plant.roster.level.vendor',
};

const levelText = (level: RosterReply['level'], c: CrudCtx) => c.t(LEVEL_KEY[level]);
const shiftName = (c: CrudCtx, id: string) =>
  rowsOf<ShiftReply>(c, 'shifts').find((shift) => shift.id === id)?.name ?? '';
const personName = (c: CrudCtx, id: string) =>
  rowsOf<PersonAdmin>(c, 'people').find((person) => person.id === id)?.name ?? '';
const shiftChoices = (c: CrudCtx): CrudChoice[] =>
  rowsOf<ShiftReply>(c, 'shifts')
    .filter((shift) => shift.active)
    .map((shift) => ({ value: shift.id, label: shift.name }));
const personChoices = (c: CrudCtx): CrudChoice[] =>
  rowsOf<PersonAdmin>(c, 'people')
    .filter((person) => person.active)
    .map((person) => ({ value: person.id, label: person.name }));
const levelChoices = (c: CrudCtx): CrudChoice[] =>
  LEVELS.map((level) => ({ value: level, label: levelText(level, c) }));

export const rosterSpec: CrudSpec<RosterReply> = {
  key: 'roster',
  path: '/api/v1/roster',
  schema: rosterReplySchema,
  titleKey: 'plant.roster.title',
  emptyKey: 'plant.roster.empty',
  addKey: 'plant.roster.add',
  footnoteKey: 'plant.audit',
  lookups: {
    shifts: { key: 'shifts', path: '/api/v1/shifts' },
    people: { key: 'people', path: '/api/v1/people' },
  },
  fields: [
    { name: 'date', labelKey: 'plant.roster.date', required: true },
    {
      name: 'shiftId',
      labelKey: 'plant.roster.shift',
      kind: 'choice',
      required: true,
      choices: shiftChoices,
    },
    {
      name: 'personId',
      labelKey: 'plant.roster.person',
      kind: 'choice',
      required: true,
      choices: personChoices,
    },
    {
      name: 'level',
      labelKey: 'plant.roster.level',
      kind: 'choice',
      required: true,
      choices: levelChoices,
    },
  ],
  look: (row, c) => ({
    title: personName(c, row.personId),
    sub: [row.date, shiftName(c, row.shiftId), levelText(row.level, c)].filter(Boolean).join(' · '),
  }),
  columns: [
    { labelKey: 'plant.roster.date', cell: (row) => row.date, sortKey: (row) => row.date },
    {
      labelKey: 'plant.roster.shift',
      cell: (row, c) => shiftName(c, row.shiftId),
      sortKey: (row, c) => shiftName(c, row.shiftId),
    },
    {
      labelKey: 'plant.roster.person',
      cell: (row, c) => personName(c, row.personId),
      sortKey: (row, c) => personName(c, row.personId),
    },
    {
      labelKey: 'plant.roster.level',
      cell: (row, c) => levelText(row.level, c),
      sortKey: (row) => row.level,
    },
  ],
  search: {
    labelKey: 'plant.roster.search',
    text: (row, c) => `${personName(c, row.personId)} ${row.date}`,
  },
};

/** The plant's own day, the one the server's roster floor and window use. */
const todayIn = (timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());

/** One action above the list: repeat a day's roster over the next seven days, once. */
function CopyRoster() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const date = picked ?? (config.data ? todayIn(config.data.timeZone) : '');

  async function copy(): Promise<void> {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await copyRoster(date));
      await client.invalidateQueries({ queryKey: [rosterSpec.key] });
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : t('kit.crud.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card">
      <Inline gap={3}>
        <Stack gap={1}>
          <Label htmlFor="roster-copy-date">{t('plant.roster.copyDate')}</Label>
          <Input
            id="roster-copy-date"
            type="date"
            value={date}
            onChange={(event) => setPicked(event.target.value)}
          />
        </Stack>
        <Button onClick={() => void copy()} disabled={busy || !date}>
          {busy ? t('common.sending') : t('plant.roster.copy')}
        </Button>
      </Inline>
      {result ? (
        <p role="status" className="text-footnote text-ok-ink">
          {t('plant.roster.copied', { created: result.created, skipped: result.skipped })}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-footnote text-danger">
          {error}
        </p>
      ) : null}
      <p className="text-caption text-neutral-600">{t('plant.roster.copyHint')}</p>
    </div>
  );
}

/** The roster screen: the generated list with the copy-week action over it. */
export function RosterScreen() {
  return (
    <div className="flex flex-col gap-4">
      <CopyRoster />
      <CrudPage spec={rosterSpec} />
    </div>
  );
}
