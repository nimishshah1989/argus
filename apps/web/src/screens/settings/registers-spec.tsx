import {
  ASSET_KINDS,
  REGISTER_LEAD_DAYS,
  assetRegisterReplySchema,
  type AssetKind,
  type AssetRegisterReply,
  type MachineReply,
} from '@uptimo/shared/plant-settings';
import type { Person } from '@uptimo/shared/config';
import { http, type Transport } from '../../data/index.js';
import type { CrudCtx, CrudSpec, LabelKey } from '../../patterns/crud-spec.js';

/**
 * The plant's asset register (ticket 51a, R6): AMC, warranty, legal tests and calibrations in one generated list.
 * The watch day is `dueOn ?? endsOn` — never `startsOn` (R8) — and the owner is the one person the notice reaches
 * (R9). The type/test text lives in `notes` in R4's convention, so the hint states it.
 */

const machines = { key: 'machines', path: '/api/v1/machines' };

/**
 * `/api/v1/people` is admin-only and a head must be able to name an owner, so the lookup reads `/config`'s roster
 * and shapes it as the `{ items }` page the generated form reads (R6).
 */
const peopleFromConfig: Transport = async (path, init) => {
  const body = await http<{ people: Person[] }>(path, init);
  return { items: body.people };
};
const people = { key: 'people', path: '/api/v1/config', transport: peopleFromConfig };

const KIND_KEY: Record<AssetKind, LabelKey> = {
  amc: 'plant.registers.kind.amc',
  warranty: 'plant.registers.kind.warranty',
  legal: 'plant.registers.kind.legal',
  calibration: 'plant.registers.kind.calibration',
};

const rowsOf = <T,>(c: CrudCtx, name: string) => (c.lookups[name] as T[] | undefined) ?? [];
const kindText = (kind: AssetKind, c: CrudCtx) => c.t(KIND_KEY[kind]);
const machineCode = (c: CrudCtx, id: string | null): string | null =>
  id
    ? (rowsOf<MachineReply>(c, 'machines').find((machine) => machine.id === id)?.code ?? null)
    : null;
const machineText = (row: AssetRegisterReply, c: CrudCtx) =>
  machineCode(c, row.machineId) ?? c.t('plant.registers.noMachine');
const ownerName = (c: CrudCtx, id: string | null): string | null =>
  id ? (rowsOf<Person>(c, 'people').find((person) => person.id === id)?.name ?? null) : null;
export const watchOf = (row: AssetRegisterReply): string | null => row.dueOn ?? row.endsOn;

const machineChoices = (c: CrudCtx) =>
  rowsOf<MachineReply>(c, 'machines')
    .map((machine) => ({ value: machine.id, label: machine.code }))
    .sort((a, b) => a.label.localeCompare(b.label));
const ownerChoices = (c: CrudCtx) =>
  rowsOf<Person>(c, 'people')
    .filter((person) => person.active)
    .map((person) => ({ value: person.id, label: person.name }));

/** The form's line: when the reminder starts, and that nobody is told without an owner (R8/R9). */
const formWatch = (values: Record<string, string>, row: AssetRegisterReply | null): string | null =>
  [values.dueOn, values.endsOn, row?.dueOn, row?.endsOn].find(Boolean) ?? null;

const formLead = (values: Record<string, string>, row: AssetRegisterReply | null): number =>
  (values.leadDays ?? '').trim() === ''
    ? (row?.leadDays ?? REGISTER_LEAD_DAYS)
    : Number(values.leadDays);

function registerNote(values: Record<string, string>, row: AssetRegisterReply | null, c: CrudCtx) {
  const watch = formWatch(values, row);
  const reminder = watch
    ? c.t('plant.registers.remindBefore', { days: formLead(values, row), date: watch })
    : c.t('plant.registers.noWatchNote');
  const owner = values.ownerPersonId ?? row?.ownerPersonId;
  return [
    reminder,
    owner ? null : c.t('plant.registers.noOwnerNote'),
    c.t('plant.registers.notesHint'),
  ]
    .filter(Boolean)
    .join(' ');
}

export const registersSpec: CrudSpec<AssetRegisterReply> = {
  key: 'registers',
  path: '/api/v1/settings/registers',
  schema: assetRegisterReplySchema,
  titleKey: 'plant.registers.title',
  emptyKey: 'plant.registers.empty',
  addKey: 'plant.registers.add',
  introKey: 'plant.registers.intro',
  footnoteKey: 'plant.audit',
  lookups: { machines, people },
  switchOff: { hintKey: 'plant.registers.removeHint', sendReason: true },
  fields: [
    {
      name: 'kind',
      labelKey: 'plant.registers.kind',
      required: true,
      kind: 'choice',
      choices: (c) => ASSET_KINDS.map((kind) => ({ value: kind, label: kindText(kind, c) })),
    },
    {
      name: 'machineId',
      labelKey: 'plant.registers.machine',
      kind: 'choice',
      choices: machineChoices,
    },
    { name: 'vendor', labelKey: 'plant.registers.vendor' },
    { name: 'reference', labelKey: 'plant.registers.reference' },
    { name: 'startsOn', labelKey: 'plant.registers.startsOn', kind: 'date' },
    { name: 'endsOn', labelKey: 'plant.registers.endsOn', kind: 'date' },
    { name: 'dueOn', labelKey: 'plant.registers.dueOn', kind: 'date' },
    { name: 'leadDays', labelKey: 'plant.registers.leadDays' },
    {
      name: 'ownerPersonId',
      labelKey: 'plant.registers.owner',
      kind: 'choice',
      choices: ownerChoices,
    },
    { name: 'notes', labelKey: 'plant.registers.notes' },
  ],
  look: (row, c) => {
    const watch = watchOf(row);
    const owner = ownerName(c, row.ownerPersonId);
    return {
      title: `${kindText(row.kind, c)} · ${machineText(row, c)}`,
      sub: [
        watch ?? c.t('plant.registers.watchNone'),
        owner ?? c.t('plant.registers.ownerNone'),
      ].join(' · '),
    };
  },
  columns: [
    {
      labelKey: 'plant.registers.kind',
      cell: (row, c) => kindText(row.kind, c),
      sortKey: (row) => row.kind,
    },
    {
      labelKey: 'plant.registers.machine',
      cell: (row, c) => machineText(row, c),
      sortKey: (row, c) => machineText(row, c),
    },
    {
      labelKey: 'plant.registers.dateColumn',
      cell: (row, c) => watchOf(row) ?? c.t('plant.registers.watchNone'),
      sortKey: (row) => watchOf(row) ?? '',
    },
    {
      labelKey: 'plant.registers.lead',
      cell: (row, c) => c.t('plant.registers.leadDaysValue', { days: row.leadDays }),
      sortKey: (row) => row.leadDays,
    },
    {
      labelKey: 'plant.registers.owner',
      cell: (row, c) => ownerName(c, row.ownerPersonId) ?? c.t('plant.registers.ownerNone'),
      sortKey: (row, c) => ownerName(c, row.ownerPersonId) ?? '',
    },
  ],
  filter: {
    allKey: 'plant.registers.allKinds',
    options: (c) => ASSET_KINDS.map((kind) => ({ code: kind, name: kindText(kind, c) })),
    of: (row) => row.kind,
  },
  search: {
    labelKey: 'plant.registers.search',
    text: (row, c) =>
      [machineText(row, c), row.vendor, row.reference, row.notes, ownerName(c, row.ownerPersonId)]
        .filter(Boolean)
        .join(' '),
  },
  note: registerNote,
};
