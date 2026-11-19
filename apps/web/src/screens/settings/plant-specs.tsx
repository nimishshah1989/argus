/* eslint-disable i18next/no-literal-string -- routes, ids and prop values only; every visible string goes through t() */
import {
  groupReplySchema,
  machineReplySchema,
  shiftReplySchema,
  type GroupReply,
  type MachineReply,
  type SegmentReply,
  type ShiftReply,
} from '@uptimo/shared/plant-settings';
import { putMachineCriticality } from '../../api.js';
import type { CrudCtx, CrudSpec } from '../../patterns/crud-spec.js';
import { Ban } from '../../ui/icon.js';
import { MachineIcon } from '../../ui/machine-icon.js';
import { TONE_FILL, segmentIcon } from '../../ui/meaning.js';
import { ProductionSwitch, ProductionTag } from './machine-production.js';

/** The plant settings screens, each one a config for `CrudPage` (D5): what the rows say and which fields a form asks. */

const segments = { key: 'segments', path: '/api/v1/segments' };
const machines = { key: 'machines', path: '/api/v1/machines' };
const rowsOf = <T,>(c: CrudCtx, name: string) => c.lookups[name] as T[];
const segmentOf = (c: CrudCtx, id: string | null) =>
  rowsOf<SegmentReply>(c, 'segments').find((s) => s.id === id);

function Chip({ children }: { children: string }) {
  return (
    <span
      className={`inline-flex h-7 items-center whitespace-nowrap rounded-full px-2.5 text-caption font-semibold ${TONE_FILL.muted}`}
    >
      {children}
    </span>
  );
}

const criticalityChip = (row: MachineReply, c: CrudCtx) => (
  <Chip>
    {row.criticality
      ? c.t('plant.machines.criticalityOf', { value: row.criticality })
      : c.t('plant.machines.notSet')}
  </Chip>
);

/**
 * The plant stores a cell as its bare label ("6"); an older row, a form or a fixture may say "Cell 6"
 * or "Cell-6". One normalisation, so a row never reads "Cell Cell 6".
 */
const bareCell = (cell: string) => cell.trim().replace(/^cell[\s-]+/i, '');
const cellText = (cell: string, c: CrudCtx) =>
  c.t('plant.machines.cellN', { cell: bareCell(cell) });
const cellOf = (row: MachineReply, c: CrudCtx) =>
  row.cell ? cellText(row.cell, c) : c.t('plant.machines.noCell');

/** A cell change is dated today by the server; the note says so before it is saved. */
function moveNote(values: Record<string, string>, row: MachineReply | null, c: CrudCtx) {
  const [from, to] = [
    row?.cell ? bareCell(row.cell) : '',
    values.cell?.trim() ? bareCell(values.cell) : '',
  ];
  if (!row || !from || !to || from === to) return null;
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return c.t('plant.machines.moves', {
    code: row.code,
    from: cellText(from, c),
    to: cellText(to, c),
    date,
  });
}

export const machinesSpec: CrudSpec<MachineReply> = {
  key: 'machines',
  path: '/api/v1/machines',
  schema: machineReplySchema,
  titleKey: 'plant.machines.title',
  emptyKey: 'plant.machines.empty',
  addKey: 'plant.machines.add',
  footnoteKey: 'plant.audit',
  introKey: 'plant.machines.production.intro',
  lookups: { segments },
  toggle: false,
  flag: {
    labelKey: 'plant.machines.production.count',
    icon: Ban,
    test: (row) => row.excludedFromProduction,
  },
  hidden: {
    excludedFromProduction:
      'Its own switch on the list, saved by PUT /machines/:id/production-data; this sheet never sends it.',
    area: 'Master data kept for the ticket; the approved sheet edits the cell, not the area.',
    location: 'Master data kept for the ticket; the approved sheet does not edit it.',
    groupId:
      'A machine is filed into a group when it is moved; this sheet changes the segment only.',
    make: 'Nameplate detail, imported once; tickets show it and this sheet never edits it.',
    model: 'Nameplate detail, imported once; tickets show it and this sheet never edits it.',
    serial: 'Nameplate detail, imported once; tickets show it and this sheet never edits it.',
    year: 'Nameplate detail, imported once; tickets show it and this sheet never edits it.',
  },
  fields: [
    { name: 'code', labelKey: 'plant.machines.code', required: true, addOnly: true },
    { name: 'category', labelKey: 'plant.machines.category', addOnly: true },
    {
      name: 'segmentId',
      labelKey: 'plant.machines.segment',
      kind: 'choice',
      choices: (c) =>
        rowsOf<SegmentReply>(c, 'segments').map((s) => ({ value: s.id, label: s.name })),
    },
    { name: 'cell', labelKey: 'plant.machines.cell' },
    {
      name: 'criticality',
      labelKey: 'plant.machines.criticality',
      kind: 'choice',
      choices: (c) => [
        { value: 'A', label: c.t('plant.machines.critical') },
        { value: 'B', label: 'B' },
        { value: 'C', label: 'C' },
      ],
    },
    {
      name: 'status',
      labelKey: 'plant.machines.status',
      kind: 'choice',
      choices: (c) =>
        (['active', 'idle', 'scrapped'] as const).map((value) => ({
          value,
          label: c.t(`plant.machines.status.${value}`),
        })),
    },
  ],
  separate: {
    criticality: (id, value) =>
      putMachineCriticality(id, (value || null) as 'A' | 'B' | 'C' | null),
  },
  note: moveNote,
  look: (row, c) => ({
    title: row.code,
    sub: [row.category, cellOf(row, c)].filter(Boolean).join(' · '),
    lead: <MachineIcon segment={segmentOf(c, row.segmentId)?.code ?? ''} status="running" />,
    chip: criticalityChip(row, c),
    tag: <ProductionTag row={row} />,
    extra: <ProductionSwitch row={row} />,
  }),
  columns: [
    {
      labelKey: 'plant.machines.cell',
      cell: (row, c) => cellOf(row, c),
      sortKey: (row) => row.cell ?? '',
    },
    {
      labelKey: 'plant.machines.criticality',
      cell: (row, c) => criticalityChip(row, c),
      sortKey: (row) => row.criticality ?? 'Z',
    },
    {
      labelKey: 'plant.machines.production.column',
      cell: (row) => <ProductionSwitch row={row} boxed />,
      sortKey: (row) => Number(row.excludedFromProduction),
    },
  ],
  search: {
    labelKey: 'plant.machines.search',
    text: (row) => `${row.code} ${row.category ?? ''}`,
  },
  filter: {
    allKey: 'plant.machines.all',
    options: (c) =>
      rowsOf<SegmentReply>(c, 'segments').map((s) => ({ code: s.code, name: s.name })),
    of: (row, c) => segmentOf(c, row.segmentId)?.code ?? null,
  },
};

const machineCount = (c: CrudCtx, groupId: string) =>
  rowsOf<MachineReply>(c, 'machines').filter((m) => m.groupId === groupId).length;

export const groupsSpec: CrudSpec<GroupReply> = {
  key: 'groups',
  path: '/api/v1/groups',
  schema: groupReplySchema,
  titleKey: 'plant.groups.title',
  emptyKey: 'plant.groups.empty',
  addKey: 'plant.groups.add',
  introKey: 'plant.groups.intro',
  lookups: { segments, machines },
  toggle: { labelKey: 'plant.groups.hide', inverted: true },
  hidden: { hidden: 'The row switch is this flag; the sheet never edits it.' },
  fields: [
    {
      name: 'segmentId',
      labelKey: 'plant.groups.segment',
      kind: 'choice',
      addOnly: true,
      required: true,
      choices: (c) =>
        rowsOf<SegmentReply>(c, 'segments').map((s) => ({ value: s.id, label: s.name })),
    },
    { name: 'code', labelKey: 'plant.groups.code', required: true, addOnly: true },
    { name: 'name', labelKey: 'plant.groups.name', required: true },
    { name: 'sort', labelKey: 'plant.groups.sort' },
  ],
  look: (row, c) => ({
    title: row.name,
    sub: c.t(row.hidden ? 'plant.groups.hidden' : 'plant.groups.shown'),
  }),
  columns: [
    {
      labelKey: 'plant.groups.segment',
      cell: (row, c) => segmentOf(c, row.segmentId)?.name ?? '',
      sortKey: (row, c) => segmentOf(c, row.segmentId)?.name ?? '',
    },
    {
      labelKey: 'plant.groups.machines',
      cell: (row, c) => machineCount(c, row.id),
      sortKey: (row, c) => machineCount(c, row.id),
    },
  ],
  section: (row, c) => {
    const segment = segmentOf(c, row.segmentId);
    const Icon = segmentIcon(segment?.code ?? '');
    const n = rowsOf<MachineReply>(c, 'machines').filter(
      (m) => m.segmentId === row.segmentId,
    ).length;
    return {
      key: row.segmentId,
      title: `${segment?.name ?? ''} · ${c.t('plant.groups.machineCount', { count: n })}`,
      lead: <Icon aria-hidden size={18} />,
    };
  },
};

const hours = (row: ShiftReply, c: CrudCtx) =>
  c.t(row.crossesMidnight ? 'plant.shifts.hoursOvernight' : 'plant.shifts.hours', {
    from: row.startsAt,
    to: row.endsAt,
  });

export const shiftsSpec: CrudSpec<ShiftReply> = {
  key: 'shifts',
  path: '/api/v1/shifts',
  schema: shiftReplySchema,
  titleKey: 'plant.shifts.title',
  emptyKey: 'plant.shifts.empty',
  addKey: 'plant.shifts.add',
  hidden: { crossesMidnight: 'Worked out from the two times and shown in the hours line.' },
  fields: [
    { name: 'code', labelKey: 'plant.shifts.code', required: true, addOnly: true },
    { name: 'name', labelKey: 'plant.shifts.name', required: true },
    { name: 'startsAt', labelKey: 'plant.shifts.startsAt', required: true, kind: 'time' },
    { name: 'endsAt', labelKey: 'plant.shifts.endsAt', required: true, kind: 'time' },
  ],
  look: (row, c) => ({ title: row.name, sub: hours(row, c) }),
  columns: [{ labelKey: 'plant.shifts.hoursColumn', cell: (row, c) => hours(row, c) }],
};
