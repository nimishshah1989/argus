import { pmPlanReplySchema, type PmPlanReply } from '@uptimo/shared/pm';
import type { MachineReply } from '@uptimo/shared/plant-settings';
import type { CrudCtx, CrudSpec } from '../../patterns/crud-spec.js';

/** The plant's PM plans (ticket 49a): one recurring plan per machine or category, edited on a generated page. */

const machines = { key: 'machines', path: '/api/v1/machines' };
const DAY = 86_400_000;

/** The calendar day of an instant in the plant's own zone, which is the zone the server's dates use. */
const dayIn = (instant: string, timeZone?: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timeZone ?? 'UTC' }).format(new Date(instant));

/**
 * R7: the plan is due at `last_done_on` else its clock anchor (`created_at`, plant-local) plus its interval.
 * Computed here in the plant's zone so a row made at local midnight never reads as yesterday.
 */
export function pmPlanNextDue(row: PmPlanReply, timeZone?: string): string | null {
  if (!row.intervalDays) return null;
  const anchor = row.lastDoneOn ?? dayIn(row.createdAt, timeZone);
  return new Date(Date.parse(`${anchor}T00:00:00Z`) + row.intervalDays * DAY)
    .toISOString()
    .slice(0, 10);
}

const machineRows = (c: CrudCtx): MachineReply[] =>
  (c.lookups.machines as MachineReply[] | undefined) ?? [];

const machineCode = (c: CrudCtx, id: string | null): string | null => {
  if (!id) return null;
  return machineRows(c).find((machine) => machine.id === id)?.code ?? null;
};

const targetText = (row: PmPlanReply, c: CrudCtx): string =>
  machineCode(c, row.machineId) ??
  (row.category
    ? c.t('pm.plans.categoryPlan', { category: row.category })
    : c.t('pm.plans.noTarget'));

export const pmPlansSpec: CrudSpec<PmPlanReply> = {
  key: 'pm-plans',
  path: '/api/v1/settings/pm-plans',
  schema: pmPlanReplySchema,
  titleKey: 'pm.plans.title',
  emptyKey: 'pm.plans.empty',
  addKey: 'pm.plans.add',
  footnoteKey: 'plant.audit',
  lookups: { machines },
  fields: [
    { name: 'title', labelKey: 'pm.plans.field.title', required: true },
    {
      name: 'machineId',
      labelKey: 'pm.plans.field.machine',
      kind: 'choice',
      choices: (c) =>
        machineRows(c)
          .filter((machine) => machine.active)
          .map((machine) => ({ value: machine.id, label: machine.code }))
          .sort((a, b) => a.label.localeCompare(b.label)),
    },
    { name: 'category', labelKey: 'pm.plans.field.category' },
    { name: 'intervalDays', labelKey: 'pm.plans.field.interval', required: true },
    { name: 'meterInterval', labelKey: 'pm.plans.field.meterInterval' },
    { name: 'meterTolerance', labelKey: 'pm.plans.field.meterTolerance' },
    { name: 'lastMeterReading', labelKey: 'pm.plans.field.lastMeterReading' },
    { name: 'lastDoneOn', labelKey: 'pm.plans.field.lastDone', kind: 'date' },
  ],
  hidden: {
    checklist:
      'A plan’s checklist comes from a PM report and is shown on the PM job; the generated form has no list editor yet.',
  },
  readOnly: {
    createdAt:
      'The plan’s clock anchor; an imported plan may start in the future, so the form never edits it.',
  },
  look: (row, c) => ({
    title: row.title,
    sub: [
      targetText(row, c),
      row.intervalDays ? c.t('pm.plans.intervalDays', { days: row.intervalDays }) : null,
      pmPlanNextDue(row, c.timeZone)
        ? c.t('pm.plans.nextDueOn', { date: pmPlanNextDue(row, c.timeZone)! })
        : null,
    ]
      .filter(Boolean)
      .join(' · '),
    chip: row.checklist.length ? c.t('pm.plans.items', { count: row.checklist.length }) : undefined,
  }),
  columns: [
    {
      labelKey: 'pm.plans.field.machine',
      cell: (row, c) => targetText(row, c),
      sortKey: (row, c) => targetText(row, c),
    },
    {
      labelKey: 'pm.plans.field.interval',
      cell: (row, c) =>
        row.intervalDays ? c.t('pm.plans.intervalDays', { days: row.intervalDays }) : '',
      sortKey: (row) => row.intervalDays ?? 0,
    },
    {
      labelKey: 'pm.plans.field.nextDue',
      cell: (row, c) => pmPlanNextDue(row, c.timeZone) ?? '',
      sortKey: (row, c) => pmPlanNextDue(row, c.timeZone) ?? '',
    },
    {
      labelKey: 'pm.plans.field.lastDone',
      cell: (row) => row.lastDoneOn ?? '',
      sortKey: (row) => row.lastDoneOn ?? '',
    },
    {
      labelKey: 'pm.plans.field.checklist',
      cell: (row, c) => c.t('pm.plans.items', { count: row.checklist.length }),
      sortKey: (row) => row.checklist.length,
    },
  ],
  search: {
    labelKey: 'pm.plans.search',
    text: (row, c) => `${row.title} ${targetText(row, c)}`,
  },
};
