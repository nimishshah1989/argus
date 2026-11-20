// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import type { Machine, Person } from '@uptimo/shared/config';
import type { Ticket } from '@uptimo/shared/replies';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';
import { fill } from '../../../i18n/fill.js';
import { printed, realReply, UUID } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { entityModel, type EntityFacts } from './adapter.js';

const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const reply = realReply();

const machines: Machine[] = ENGINE_DATA.machines.map((m) => ({
  id: m.id,
  code: m.code,
  category: m.category,
  cell: m.cell,
  segment_id: null,
  group_id: null,
  criticality: null,
}));
const people: Person[] = [
  { id: 'p-1', name: 'Person 51', team: 'Maintenance', title: 'Technician', active: true },
];
const tracked = ENGINE_DATA.machines.find(
  (m) => m.segment === 'CNC' && !m.excludedFromProduction && m.cell,
)!;
const facts = (open: Ticket[] = []): EntityFacts => ({ machines, people, open, reply });
const stopped = (machineId: string, over: Partial<Ticket> = {}) =>
  ({
    ref: 'T-1',
    problem: 'Spindle alarm',
    kind: 'stopped',
    machineId,
    assignedToPersonId: null,
    leadPersonId: null,
    ...over,
  }) as Ticket;

describe('the drawers, from the plant’s own lists and the engine’s reply', () => {
  it('opens a machine by the code the plant uses, which the invented gallery codes never matched', () => {
    const model = entityModel({ kind: 'machine', id: tracked.code }, facts(), t);
    expect(model?.kind).toBe('machine');
    if (model?.kind !== 'machine') return;
    expect(model.machine.code).toBe(tracked.code);
    expect(model.machine.cell).toBe(tracked.cell);
    expect(model.machine.state).toBe('run');
    expect(model.machine.untracked).toBeUndefined();
    expect(model.machine.hours.value).toBeGreaterThan(0);
    expect(model.machine.hours.shown).toMatch(/^\d[\d,]*\.\d h$/);
    expect(model.source).toContain('11-Nov-2026');
  });

  it('says a machine is stopped while a stopped ticket is open on it, and why', () => {
    const model = entityModel(
      { kind: 'machine', id: tracked.code },
      facts([stopped(tracked.id)]),
      t,
    );
    if (model?.kind !== 'machine') throw new Error('not a machine');
    expect(model.machine.state).toBe('down');
    expect(printed(model.machine.why)).toContain('Ticket T-1: Spindle alarm');
  });

  it('leaves out the figures of a machine the plant does not track, instead of printing zeros', () => {
    const other = ENGINE_DATA.machines.find((m) => m.segment !== 'CNC')!;
    const model = entityModel({ kind: 'machine', id: other.code }, facts(), t);
    if (model?.kind !== 'machine') throw new Error('not a machine');
    expect(model.machine.untracked).toBe(true);
  });

  it('opens a cell with its machines counted and their hours added up', () => {
    const model = entityModel({ kind: 'cell', id: tracked.cell! }, facts(), t);
    if (model?.kind !== 'cell') throw new Error('not a cell');
    const inCell = machines.filter((m) => m.cell === tracked.cell);
    expect(model.cell.machineCount).toBe(`${inCell.length} machines`);
    expect(model.cell.hours.value).toBeGreaterThan(0);
    expect(model.cell.worst.length).toBeLessThanOrEqual(3);
  });

  it('opens a person by id or by the name chips print, with the machines open with them', () => {
    const open = [stopped(tracked.id, { assignedToPersonId: 'p-1' })];
    for (const id of ['p-1', 'person-51']) {
      const model = entityModel({ kind: 'person', id }, facts(open), t);
      if (model?.kind !== 'person') throw new Error('not a person');
      expect(model.person.name).toBe('Person 51');
      expect(model.person.now.map((n) => n.chip.id)).toEqual([tracked.code]);
    }
  });

  it('is nothing, never a model with holes, for what the plant does not list', () => {
    expect(entityModel({ kind: 'machine', id: 'NOPE-1' }, facts(), t)).toBeNull();
    expect(entityModel({ kind: 'cell', id: 'no cell' }, facts(), t)).toBeNull();
    expect(entityModel({ kind: 'person', id: 'nobody' }, facts(), t)).toBeNull();
    expect(entityModel({ kind: 'decision', id: 'axis' }, facts(), t)).toBeNull();
  });

  it('never prints a database id where a code or a name belongs', () => {
    const model = entityModel({ kind: 'cell', id: tracked.cell! }, facts([stopped(tracked.id)]), t);
    expect(printed(model).some((text) => UUID.test(text))).toBe(false);
  });
});
