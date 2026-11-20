// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '@uptimo/shared';
import { run } from '@uptimo/domain';
import { en } from '@uptimo/shared/i18n';
import type { DrillReply, FiguresReply } from '@uptimo/shared/analytics';
import type { TFunction } from 'i18next';
import { ENGINE_DATA } from '../../../../../packages/domain/test/answer-key/fixture.js';
import { fill } from '../../i18n/fill.js';
import { ageModel } from './age/adapter.js';
import { fixFinderModel } from './fix-finder/adapter.js';
import { AS_OF, UUID } from './figures/real-reply.js';
import type { Translate } from './figures/read.js';
import { footprintModel } from './footprint/adapter.js';
import { registersModel } from './machines-register/adapter.js';
import { problemAnalysisModel } from './problem-analysis/adapter.js';
import { rowsModel } from './rows-behind/model.js';

/**
 * The answer-key fixture sets every machine's id equal to its code, so a screen that prints or looks up by an engine id
 * passes there and prints database ids on the real server. Here every machine's id is a UUID that is not its code, as
 * the server sends it: no such id may reach a screen, a chip, a link or the rows panel, and a machine is still found
 * by its code.
 */
const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const tf = ((key: string) => (en as Record<string, string>)[key] ?? key) as TFunction;

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const machines = ENGINE_DATA.machines;
const idOf = new Map(machines.map((machine, at) => [machine.id, uuid(at + 1)]));
const codeOfId = new Map(machines.map((machine) => [idOf.get(machine.id)!, machine.code]));
const codes = new Set(machines.map((machine) => machine.code));

/** Every machine id in the data replaced by its UUID: the machine's own `id`, and every `machineId` that names one. */
function rekey(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return value.map((item) => rekey(item, key));
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([name, inner]) => [name, rekey(inner, name)]),
    );
  return key === 'machineId' && typeof value === 'string' ? (idOf.get(value) ?? value) : value;
}
const data = {
  ...(rekey({ ...ENGINE_DATA, machines: [] }) as typeof ENGINE_DATA),
  machines: machines.map((machine) => ({ ...machine, id: idOf.get(machine.id)! })),
};
const result = run(data, AS_OF, DEFAULT_PROFILE);
const reply = {
  asOf: AS_OF,
  profile: {} as FiguresReply['profile'],
  excludedMachines: 0,
  rows: { machines: 0, moves: 0, tickets: 0, tasks: 0, reports: 0, people: 0 },
  figures: result.figures as unknown as FiguresReply['figures'],
} as FiguresReply;

const everything = (model: unknown): string => JSON.stringify(model);
/** Every machine chip in a model: it names a machine by its code, never an id. */
function machineChips(value: unknown, found: { id: string; label: string }[] = []) {
  if (Array.isArray(value)) value.forEach((item) => machineChips(item, found));
  else if (value !== null && typeof value === 'object') {
    const chip = value as { kind?: unknown; id?: unknown; label?: unknown };
    if (chip.kind === 'machine') found.push({ id: String(chip.id), label: String(chip.label) });
    Object.values(value).forEach((inner) => machineChips(inner, found));
  }
  return found;
}

const screens: [string, unknown][] = [
  ['Machines register', registersModel(reply, t)],
  ['Age', ageModel(reply, t)],
  ['Footprint', footprintModel(reply, t)],
  ['Fix Finder', fixFinderModel(reply, tf)],
  ['Problem Analysis', problemAnalysisModel(reply, tf)],
];

describe('with the machine ids the server sends (UUIDs, not codes)', () => {
  it('has re-keyed the plant: every machine has an id that is not its code', () => {
    expect(
      data.machines.every((machine) => UUID.test(machine.id) && machine.id !== machine.code),
    ).toBe(true);
    expect(data.machines.length).toBeGreaterThan(100);
  });

  for (const [name, model] of screens)
    it(`${name}: no database id reaches the screen, and every machine chip is named by its code`, () => {
      expect(model, name).not.toBeNull();
      const printed = everything(model);
      expect(printed.match(UUID), name).toBeNull();
      for (const chip of machineChips(model)) {
        expect(codes.has(chip.id), `${name}: chip id ${chip.id}`).toBe(true);
        expect(chip.label, name).toBe(chip.id);
      }
    });

  it('Machines register: the machine list still names each machine by its code, with its own category', () => {
    const model = registersModel(reply, t)!;
    const chips = machineChips(model);
    expect(chips.length).toBeGreaterThan(50);
    const byCode = new Map(machines.map((machine) => [machine.code, machine]));
    for (const chip of chips) expect(byCode.get(chip.id)).toBeDefined();
  });

  it('Fix Finder and Problem Analysis: machines in the tables are chips by code', () => {
    expect(machineChips(fixFinderModel(reply, tf)).length).toBeGreaterThan(0);
    expect(machineChips(problemAnalysisModel(reply, tf)).length).toBeGreaterThan(0);
  });

  it('the rows panel: machines and tickets are named by code, ids never printed or linked', () => {
    const figure = (key: string) => reply.figures.find((candidate) => candidate.key === key)!;
    const machineIds = figure('registers').drill.ids;
    expect(machineIds.length).toBeGreaterThan(100);
    const machineRows = machineIds.map((id) => {
      const machine = data.machines.find((candidate) => candidate.id === id)!;
      return { ...machine, status: 'active' as const };
    });
    const asRows = (type: 'machine' | 'ticket', rows: unknown[]) =>
      ({ type, rows }) as unknown as DrillReply;
    const code = (id: string) => codeOfId.get(id);
    const machinesPanel = rowsModel(
      {
        key: 'registers',
        value: null,
        reply: asRows('machine', machineRows),
        asOf: AS_OF,
        machineCode: code,
      },
      t,
    )!;
    expect(everything(machinesPanel).match(UUID)).toBeNull();
    expect(machineChips(machinesPanel).length).toBeGreaterThanOrEqual(machineRows.length);
    expect(machineChips(machinesPanel).every((chip) => codes.has(chip.id))).toBe(true);

    const tickets = figure('fix-finder').drill.ids.map((id) => {
      const ticket = data.tickets.find((candidate) => candidate.id === id)!;
      return {
        id,
        ref: `T-${id.slice(-4)}`,
        kind: 'breakdown',
        status: 'closed',
        machineId: ticket.machineId,
        reportedAt: '2026-11-01T00:00:00.000Z',
        closedAt: null,
        source: 'history',
        downtimeMin: 30,
        repairMin: 20,
        workType: null,
      };
    });
    const ticketsPanel = rowsModel(
      {
        key: 'fix-finder',
        value: null,
        reply: asRows('ticket', tickets),
        asOf: AS_OF,
        machineCode: code,
      },
      t,
    )!;
    const printed = everything(ticketsPanel);
    for (const machineUuid of codeOfId.keys()) expect(printed).not.toContain(machineUuid);
    expect(machineChips(ticketsPanel).length).toBeGreaterThan(0);

    // A machine the plant no longer lists is a dash, never its id.
    const unlisted = rowsModel(
      {
        key: 'fix-finder',
        value: null,
        reply: asRows('ticket', tickets),
        asOf: AS_OF,
        machineCode: () => undefined,
      },
      t,
    )!;
    for (const machineUuid of codeOfId.keys())
      expect(everything(unlisted)).not.toContain(machineUuid);
  });
});
