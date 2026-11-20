import type { FiguresReply } from '@uptimo/shared/analytics';
import type { Machine, Person } from '@uptimo/shared/config';
import type { Ticket } from '@uptimo/shared/replies';
import { fill } from '../../../i18n/fill.js';
import type { CellDetailData } from '../../../ui/v2/domain/cell-detail.js';
import type { MachineData, MachineState } from '../../../ui/v2/domain/plant.js';
import type { PersonDetailData } from '../../../ui/v2/domain/person-detail.js';
import type { EntityRef } from '../../../ui/v2/entity-chip.js';
import { machineRecord, type MachineRecord } from '../../analytics/machine-record.js';
import { catOf, dayText, machineChip, sourceLine, type Translate } from '../figures/read.js';
import type { EntityModel } from './model.js';

/** What the plant knows: its lists, the tickets open now, and the engine's reply for the machine pages. */
export type EntityFacts = {
  machines: readonly Machine[];
  people: readonly Person[];
  open: readonly Ticket[];
  reply: Pick<FiguresReply, 'asOf' | 'figures'>;
};

/** A cell is asked for by its name, which is what the config's machines carry; a person by id or by the slug of the name. */
const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const stoppedOn = (open: readonly Ticket[], machineId: string): Ticket[] =>
  open.filter((ticket) => ticket.machineId === machineId && ticket.kind === 'stopped');

function hoursText(hours: number): string {
  return `${hours.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

function recordOf(facts: EntityFacts, machine: Machine): MachineRecord | null {
  const figure = facts.reply.figures.find((f) => f.key === 'machine-page');
  return figure?.status === 'ready' ? machineRecord(figure.value, machine.id) : null;
}

const stateOf = (facts: EntityFacts, machine: Machine): MachineState =>
  stoppedOn(facts.open, machine.id).length > 0 ? 'down' : 'run';

function machineData(facts: EntityFacts, machine: Machine, t: Translate): MachineData {
  const record = recordOf(facts, machine);
  const make = [record?.machine.make, record?.machine.model].filter(Boolean).join(' ');
  const hours = record?.breakdowns?.hours;
  const category = machine.category ?? t('v2m.none');
  return {
    code: machine.code,
    name: make || category,
    typeLabel: category,
    cat: catOf(category) as MachineData['cat'],
    cell: machine.cell ?? t('v2m.none'),
    state: stateOf(facts, machine),
    hours: {
      shown: fill(t('v2m.entity.hoursUnit'), { n: hoursText(hours ?? 0) }),
      value: hours ?? 0,
    },
    stops: record?.breakdowns?.count ?? 0,
    ...(record?.breakdowns ? {} : { untracked: true as const }),
    trend: [],
    why: stoppedOn(facts.open, machine.id)
      .slice(0, 3)
      .map((ticket) => [
        { text: fill(t('v2m.entity.ticket'), { ref: ticket.ref, problem: ticket.problem }) },
      ]),
  };
}

function cellData(facts: EntityFacts, name: string, t: Translate): CellDetailData | null {
  const inCell = facts.machines.filter((machine) => machine.cell === name);
  if (inCell.length === 0) return null;
  const rows = inCell.map((machine) => machineData(facts, machine, t));
  const down = rows.filter((row) => row.state === 'down').length;
  const total = rows.reduce((sum, row) => sum + row.hours.value, 0);
  return {
    name: fill(t('v2m.reg.cell'), { n: name }),
    machineCount: fill(t('v2m.entity.machines'), { n: inCell.length }),
    mix: [
      ...(down > 0
        ? [{ state: 'down' as const, text: fill(t('v2m.entity.mixDown'), { n: down }) }]
        : []),
      ...(rows.length - down > 0
        ? [{ state: 'run' as const, text: fill(t('v2m.entity.mixRun'), { n: rows.length - down }) }]
        : []),
    ],
    hours: { shown: fill(t('v2m.entity.hoursUnit'), { n: hoursText(total) }), value: total },
    worst: rows
      .filter((row) => row.hours.value > 0)
      .sort((a, b) => b.hours.value - a.hours.value)
      .slice(0, 3)
      .map((row) => ({ chip: machineChip(row.code, row.typeLabel), hours: row.hours.shown })),
  };
}

function personData(facts: EntityFacts, person: Person, t: Translate): PersonDetailData {
  const byId = new Map(facts.machines.map((machine) => [machine.id, machine]));
  const mine = facts.open.filter(
    (ticket) =>
      (ticket.assignedToPersonId === person.id || ticket.leadPersonId === person.id) &&
      ticket.machineId !== null,
  );
  return {
    name: person.name,
    role: person.title ?? person.team,
    now: mine.flatMap((ticket) => {
      const machine = byId.get(ticket.machineId ?? '');
      return machine
        ? [{ chip: machineChip(machine.code, machine.category ?? ''), note: ticket.problem }]
        : [];
    }),
    jobs: '',
    hours: '',
  };
}

/**
 * The drawer's model for a machine, cell or person from what the plant holds: its lists, the tickets open now and the
 * engine's machine pages. A decision has no source until the Action Center is live, and a thing the plant does not
 * list is nothing, never a model with holes. Nothing is invented: a part with no source (a trend, a month's jobs) is
 * left empty and the drawer leaves it out.
 */
export function entityModel(ref: EntityRef, facts: EntityFacts, t: Translate): EntityModel | null {
  const source = sourceLine(t('v2m.source'), facts.reply.asOf);
  const common = { id: ref.id, source };
  const words = {
    machine: {
      states: {
        run: t('v2m.entity.run'),
        risk: t('v2m.entity.risk'),
        down: t('v2m.entity.down'),
        pm: t('v2m.entity.pm'),
        idle: t('v2m.entity.idle'),
      },
      figures: t('v2m.entity.record'),
      hours: t('v2m.entity.hours'),
      stops: t('v2m.entity.stops'),
      trend: '',
      why: t('v2m.entity.why'),
    },
    cell: {
      now: t('v2m.entity.now'),
      figures: t('v2m.entity.record'),
      hours: t('v2m.entity.hours'),
      worst: t('v2m.entity.worst'),
    },
    person: {
      now: t('v2m.entity.onNow'),
      free: t('v2m.entity.free'),
      month: t('v2m.entity.month'),
      jobs: t('v2m.entity.jobs'),
      hours: t('v2m.entity.hoursWorked'),
    },
  };
  if (ref.kind === 'machine') {
    const machine = facts.machines.find((m) => m.code === ref.id || m.id === ref.id);
    if (!machine) return null;
    const data = machineData(facts, machine, t);
    return { ...common, kind: 'machine', label: data.code, machine: data, words: words.machine };
  }
  if (ref.kind === 'cell') {
    const cell = cellData(facts, ref.id, t);
    return cell ? { ...common, kind: 'cell', label: cell.name, cell, words: words.cell } : null;
  }
  if (ref.kind === 'person') {
    const person = facts.people.find((p) => p.id === ref.id || slug(p.name) === ref.id);
    if (!person) return null;
    return {
      ...common,
      kind: 'person',
      label: person.name,
      person: personData(facts, person, t),
      words: words.person,
    };
  }
  return null;
}
