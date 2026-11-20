import { createHash } from 'node:crypto';
import type { EngineData, EngineSettings, NudgeAck } from '../../src/index.js';

/**
 * The answer-key fixture lies about ids: every machine's id equals its code, every ticket's id its reference. A
 * plant's database gives each of them a UUID the user must never read. `rekeyToUuids` rewrites every row id of an
 * `EngineData` to a UUID that is not its code, in every relation that names it (a report's machine and ticket, a
 * move's machine, a plan's machine, the settings' machine list, the Action Center's saved-ack keys), and keeps every
 * code, reference and coded person name as it was. A figure run over the result must print the codes it printed
 * before and carry the UUIDs only in the fields that are references.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const isUuid = (value: string): boolean => UUID.test(value);

/** A stable UUID per (kind, old id): two rows of different kinds that shared an id in the fixture stay apart. */
export function uuidFor(kind: string, id: string): string {
  const hex = createHash('sha1').update(`${kind}:${id}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export type Kind = 'machine' | 'ticket' | 'report' | 'move' | 'person' | 'line' | 'plan';

/** The Action Center's ack key (`freq|<machine id>`, `long|<report id>`, `amc|<line id>|<end>`): ids re-keyed. */
function ackKey(key: string): string {
  const [type, first, ...rest] = key.split('|');
  const kind: Kind | undefined = {
    recur: 'machine',
    freq: 'machine',
    rise: 'machine',
    mttr: 'machine',
    newm: 'machine',
    spares: 'machine',
    long: 'report',
    amc: 'line',
    legal: 'line',
  }[type ?? ''] as Kind | undefined;
  if (kind === undefined || first === undefined) return key;
  return [type, uuidFor(kind, first), ...rest].join('|');
}

const machine = (id: string): string => uuidFor('machine', id);
const ticket = (id: string): string => uuidFor('ticket', id);
const optional = (id: string | null, to: (id: string) => string): string | null =>
  id === null ? null : to(id);

/** An AMC or legal line: its own id, its register item and its machine. */
const rekeyLine = <T extends { id: string; machineId: string; itemKey?: string }>(line: T): T => ({
  ...line,
  id: uuidFor('line', line.id),
  machineId: machine(line.machineId),
  ...(line.itemKey === undefined ? {} : { itemKey: uuidFor('line', line.itemKey) }),
});

const keyed = <T>(
  record: Readonly<Record<string, T>> | undefined,
  to: (key: string) => string,
): Record<string, T> | undefined =>
  record && Object.fromEntries(Object.entries(record).map(([key, value]) => [to(key), value]));

function rekeySettings(settings: EngineSettings): EngineSettings {
  return {
    ...settings,
    excludedMachineIds: settings.excludedMachineIds.map(machine),
    problemFixes: keyed(settings.problemFixes, (id) => uuidFor('report', id)) ?? {},
    nudgeAcks: keyed<NudgeAck>(settings.nudgeAcks, ackKey),
  };
}

export function rekeyToUuids(data: EngineData): EngineData {
  return {
    ...data,
    machines: data.machines.map((row) => ({ ...row, id: machine(row.id) })),
    moves: data.moves.map((row) => ({
      ...row,
      id: uuidFor('move', row.id),
      machineId: machine(row.machineId),
    })),
    tickets: data.tickets.map((row) => ({
      ...row,
      id: ticket(row.id),
      machineId: optional(row.machineId, machine),
    })),
    tasks: data.tasks.map((row) => ({
      ...row,
      id: ticket(row.id),
      parentId: ticket(row.parentId),
      machineId: optional(row.machineId, machine),
    })),
    reports: data.reports.map((row) => ({
      ...row,
      id: uuidFor('report', row.id),
      ticketId: optional(row.ticketId, ticket),
      machineId: machine(row.machineId),
    })),
    people: data.people.map((row) => ({ ...row, id: uuidFor('person', row.id) })),
    whyWhy: data.whyWhy?.map((row) => ({ ...row, ticketId: ticket(row.ticketId) })),
    plantEvents: data.plantEvents?.map((event) => ({
      ticketId: ticket(event.ticketId),
      lines: event.lines.map((line) => ({ ...line, machineId: machine(line.machineId) })),
    })),
    amc: data.amc?.map(rekeyLine),
    legal: data.legal?.map(rekeyLine),
    pmPlans: data.pmPlans?.map((plan) => ({
      ...plan,
      id: uuidFor('plan', plan.id),
      machineId: optional(plan.machineId, machine),
    })),
    ...(data.settings ? { settings: rekeySettings(data.settings) } : {}),
  };
}

/** Every UUID `rekeyToUuids` makes, with the id it stands for, so a run's output can be read back in the fixture's ids. */
export function originalIds(data: EngineData): Map<string, string> {
  const back = new Map<string, string>();
  const add = (kind: Kind, ids: readonly (string | undefined)[]): void => {
    for (const id of ids) if (id !== undefined) back.set(uuidFor(kind, id), id);
  };
  add(
    'machine',
    data.machines.map((row) => row.id),
  );
  add(
    'ticket',
    [...data.tickets, ...data.tasks].map((row) => row.id),
  );
  add(
    'report',
    data.reports.map((row) => row.id),
  );
  add(
    'move',
    data.moves.map((row) => row.id),
  );
  add(
    'person',
    data.people.map((row) => row.id),
  );
  add(
    'line',
    [...(data.amc ?? []), ...(data.legal ?? [])].flatMap((row) => [row.id, row.itemKey]),
  );
  add(
    'plan',
    (data.pmPlans ?? []).map((row) => row.id),
  );
  return back;
}

/**
 * A figure's value without the code fields the engine writes beside an id: a chart point's `code` (next to its `id`)
 * and a Team Focus action's `machineCode`. The frozen keys never held them, so a test that holds a figure whole
 * against a key reads it through this. The fixture's ids equal its codes, so a code that differs from its id throws.
 */
export function withoutCodeFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => withoutCodeFields(item)) as T;
  if (value === null || typeof value !== 'object') return value;
  const own = value as Record<string, unknown>;
  const idOf = (key: string): unknown | undefined =>
    key === 'machineCode' ? own.machine : key === 'code' && 'id' in own ? own.id : undefined;
  const kept = Object.entries(own).filter(([key, item]) => {
    const id = idOf(key);
    if (id === undefined) return true;
    if (item !== id) throw new Error(`${key} ${String(item)} is not the id ${String(id)}`);
    return false;
  });
  return Object.fromEntries(kept.map(([key, item]) => [key, withoutCodeFields(item)])) as T;
}
