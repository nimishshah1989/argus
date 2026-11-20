import type { Ticket } from '@uptimo/shared/replies';
import type { MessageKey } from '@uptimo/shared/i18n';
import { MACHINE_FIELD_LABELS, type MachineRecord } from '../../analytics/machine-record.js';
import { dayKey } from '../../analytics/machine-values.js';
import { readMachineTasks, type MachineTaskRow } from '../../analytics/pm-calendar-view.js';
import { dayText, type Translate } from '../figures/read.js';
import { engineTable } from '../figures/table.js';
import { commonWords, tableWords } from '../figures/words.js';
import { drillOf, number } from './format.js';
import type { Fact, MachinePageModel, TaskRow } from './model.js';

/** The nameplate: what the machine is, a fact the plant never recorded left out rather than guessed. */
export function nameplateFacts(record: MachineRecord, t: Translate): Fact[] {
  const m = record.machine;
  const items: [MessageKey, string | null][] = [
    ['analytics.machine.fact.segment', m.segment],
    ['analytics.machine.fact.category', m.category],
    ['analytics.machine.fact.make', m.make],
    ['analytics.machine.fact.model', m.model],
    ['analytics.machine.fact.serial', m.serial],
    ['analytics.machine.fact.controller', m.controller],
    ['analytics.machine.fact.controllerModel', m.controllerModel],
    ['analytics.machine.fact.controllerSerial', m.controllerSerial],
    ['analytics.machine.fact.assetCode', m.assetCode],
    ['analytics.machine.fact.year', m.year === null ? null : String(m.year)],
    ['analytics.machine.fact.purchasedOn', m.purchasedOn === null ? null : dayText(m.purchasedOn)],
    ['analytics.machine.fact.cell', m.cell],
    ['analytics.machine.fact.location', m.location],
    ['analytics.machine.fact.conveyor', m.conveyor],
  ];
  return items.flatMap(([label, value]) =>
    value === null ? [] : [{ id: label, label: t(label), value }],
  );
}

const STATUS_WORD: Record<Ticket['status'], MessageKey> = {
  open: 'status.floor.booked',
  working: 'status.ticket.inProgress',
  waiting: 'status.ticket.waiting',
  closed: 'status.ticket.closed',
  cancelled: 'status.ticket.cancelled',
};

function taskOf(row: MachineTaskRow, t: Translate): TaskRow {
  return {
    id: row.id,
    ref: row.ref,
    problem: row.problem,
    scheduled:
      row.scheduledOn === null ? null : t('pm.tasks.scheduled', { date: dayText(row.scheduledOn) }),
    overdue: row.overdue ? t('status.pm.overdue') : null,
    status: t(STATUS_WORD[row.status]),
    href: `/desk/${encodeURIComponent(row.id)}`,
  };
}

/** The open tasks and the PM jobs from the machine's open tickets; the block says so when they could not be read. */
export function tasksBlock(
  tickets: readonly Ticket[] | null,
  at: { asOf: string; timeZone: string },
  t: Translate,
): MachinePageModel['tasks'] {
  const tasks =
    tickets === null ? null : readMachineTasks(tickets, { today: at.asOf, timeZone: at.timeZone });
  return {
    title: t('pm.tasks.title'),
    asOf: t('pm.tasks.asOf', { date: dayText(at.asOf) }),
    unavailable: tasks === null ? t('pm.tasks.unavailable') : null,
    open: {
      title: t('pm.tasks.open'),
      empty: t('pm.tasks.openEmpty'),
      rows: (tasks?.open ?? []).map((row) => taskOf(row, t)),
    },
    pm: {
      title: t('pm.tasks.pm'),
      empty: t('pm.tasks.pmEmpty'),
      rows: (tasks?.pm ?? []).map((row) => taskOf(row, t)),
    },
  };
}

/** Where the machine has been: date, cell and location, the date column sorting as a day. */
export function movesBlock(
  record: MachineRecord,
  machineId: string,
  t: Translate,
): MachinePageModel['moves'] {
  const title = t('analytics.machine.moves');
  const absent = t('analytics.value.none');
  const base = engineTable(
    {
      title,
      header: [
        t('analytics.cellLog.date'),
        t('analytics.cellLog.cell'),
        t('analytics.cellLog.location'),
      ],
      rows: record.moves.map((move) => [
        dayText(move.date),
        `${move.fromCell ?? absent} → ${move.toCell ?? absent}`,
        move.fromLocation !== null && move.fromLocation === move.toLocation
          ? t('analytics.cellLog.noChange')
          : `${move.fromLocation ?? absent} → ${move.toLocation ?? absent}`,
      ]),
    },
    { id: 'moves', title, words: tableWords(commonWords(t), title, record.moves.length) },
  );
  const table =
    record.moves.length === 0
      ? null
      : {
          ...base,
          rows: base.rows.map((row, at) => [
            { ...row[0]!, sort: dayKey(record.moves[at]!.date) },
            ...row.slice(1),
          ]),
        };
  return {
    title,
    none: t('analytics.machine.noMoves'),
    table,
    drill: drillOf({ machineId, part: 'moves', ids: record.drills.moves }, title, t),
  };
}

/** The PM visits and hours, and how complete the record is (with the fields still missing). */
export function recordBlocks(
  record: MachineRecord,
  machineId: string,
  t: Translate,
): Pick<MachinePageModel, 'pm' | 'completeness'> {
  const none = t('analytics.machine.notAvailable');
  const { pm, completeness: complete } = record;
  const missing = complete?.missing
    .map((field) => MACHINE_FIELD_LABELS[field])
    .filter((label): label is MessageKey => label !== undefined)
    .map((label) => t(label))
    .join(', ');
  const title = t('analytics.machine.pm');
  const unit = t('analytics.machine.unit.hours');
  return {
    pm: {
      title,
      facts: [
        {
          id: 'visits',
          label: t('analytics.machine.pmVisits'),
          value: pm?.visits == null ? none : number(pm.visits, 0),
        },
        {
          id: 'hours',
          label: t('analytics.machine.pmHours'),
          value: pm?.hours == null ? none : `${number(pm.hours, 2)} ${unit}`,
        },
      ],
      drill: drillOf({ machineId, part: 'pm', ids: record.drills.pm }, title, t),
    },
    completeness: {
      title: t('analytics.machine.completeness'),
      fact: {
        id: 'recorded',
        label: t('analytics.machine.completeness'),
        value:
          complete === null
            ? none
            : t('analytics.machine.completenessValue', {
                recorded: complete.recorded,
                of: complete.of,
              }),
        ...(missing ? { note: t('analytics.machine.missing', { fields: missing }) } : {}),
      },
    },
  };
}
