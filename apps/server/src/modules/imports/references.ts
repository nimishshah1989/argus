import { activePeople, ensurePendingPerson, personCode } from '../identity/index.js';
import {
  activeListItems,
  activeMachineByCode,
  machineByCode,
  shiftsOf,
  switchedOffListItems,
} from '../plant/index.js';
import { normalizeCode, normalizeKey } from './json.js';
import type { ImportCtx } from './batch.js';
import type {
  CodeReference,
  PendingPerson,
  ReconcileReferences,
  ShiftReference,
  WaitReasonReference,
} from './reconcile.js';
import type { AliasConfig, BhavinTicket } from './schema.js';

const LISTS = [
  'work_type',
  'location',
  'wait_reason',
  'breakdown_category',
  'observed_by',
  'maint_code',
] as const;

function names(ticket: BhavinTicket): string[] {
  const result = new Set<string>();
  const add = (value: string | null) => {
    if (value) result.add(value);
  };
  add(ticket.reportedByPerson);
  for (const key of [
    'leadPerson',
    'transferToPerson',
    'pausedByPerson',
    'assignedToPerson',
    'closedByPerson',
  ] as const) {
    add(ticket.state[key]);
  }
  for (const event of ticket.events) {
    add(event.by);
    if (event.type === 'pause') add(event.payload.assignTo);
    if (event.type === 'transfer') add(event.payload.to);
    if (event.type === 'edit') {
      for (const change of event.payload.changes) {
        if (change.field === 'leadPerson' || change.field === 'closedByPerson') {
          add(change.from as string | null);
          add(change.to as string | null);
        }
      }
    }
  }
  for (const member of ticket.crew) add(member.person);
  for (const segment of ticket.segments) add(segment.person);
  for (const report of ticket.reports) {
    add(report.submittedBy);
    report.doneBy.forEach(add);
    report.supportedBy.forEach(add);
  }
  return [...result];
}

const PERSON_CODE = /^p-[0-9a-f]{8}$/;

function displayName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

function addCode<T extends CodeReference>(map: Map<string, T>, key: string, value: T): void {
  const normalized = normalizeCode(key);
  if (map.has(normalized)) throw new Error(`Duplicate normalized active code: ${key}`);
  map.set(normalized, value);
}

async function loadLists(
  ctx: ImportCtx,
  past: boolean,
): Promise<{
  workTypes: Map<string, CodeReference>;
  locations: Map<string, CodeReference>;
  waitReasons: Map<string, WaitReasonReference>;
  breakdownCategories: Map<string, CodeReference>;
  observedBy: Map<string, CodeReference>;
  maintenanceCodes: Map<string, CodeReference>;
}> {
  const rows = await activeListItems(ctx.client, ctx.tenantId, [...LISTS]);
  const maps = {
    workTypes: new Map<string, CodeReference>(),
    locations: new Map<string, CodeReference>(),
    waitReasons: new Map<string, WaitReasonReference>(),
    breakdownCategories: new Map<string, CodeReference>(),
    observedBy: new Map<string, CodeReference>(),
    maintenanceCodes: new Map<string, CodeReference>(),
  };
  const targets = {
    work_type: maps.workTypes,
    location: maps.locations,
    wait_reason: maps.waitReasons,
    breakdown_category: maps.breakdownCategories,
    observed_by: maps.observedBy,
    maint_code: maps.maintenanceCodes,
  } as const;
  for (const row of rows) {
    const code = row.code as string;
    addCode(targets[row.list as keyof typeof targets], code, {
      code,
      ...(row.list === 'wait_reason'
        ? { isVendor: row.is_vendor as boolean, pausesSla: row.pauses_sla as boolean }
        : {}),
    });
  }
  // A past row may carry a code that is switched off today (ticket 47: off for new tickets, shown on old reports).
  const off = past ? await switchedOffListItems(ctx.client, ctx.tenantId, ['maint_code']) : [];
  for (const row of off) {
    const known = maps.maintenanceCodes.has(normalizeCode(row.code as string));
    if (!known) addCode(maps.maintenanceCodes, row.code as string, { code: row.code as string });
  }
  return maps;
}

async function loadShifts(ctx: ImportCtx): Promise<Map<string, ShiftReference>> {
  const shifts = new Map<string, ShiftReference>();
  for (const row of await shiftsOf(ctx.client, ctx.tenantId)) {
    addCode(shifts, row.code as string, {
      code: row.code as string,
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
      crossesMidnight: row.crosses_midnight as boolean,
    });
  }
  return shifts;
}

function machineAliases(aliases: AliasConfig): Map<string, string> {
  return new Map(
    Object.entries(aliases.machines).map(([source, target]) => [
      normalizeCode(source),
      normalizeCode(target),
    ]),
  );
}

type MachineRef = NonNullable<ReconcileReferences['machine']>;

/** A live ticket needs an active machine; a past row may name one that is no longer active. */
async function findMachine(
  ctx: ImportCtx,
  source: string,
  aliases: Map<string, string>,
  past: boolean,
): Promise<MachineRef> {
  const normalized = normalizeCode(source);
  const code = aliases.get(normalized) ?? normalized;
  const find = past ? machineByCode : activeMachineByCode;
  const rows = await find(ctx.client, ctx.tenantId, code);
  if (rows.length !== 1) throw new Error(`Unknown or inactive machine: ${code}`);
  return rows[0] as MachineRef;
}

async function loadMachine(
  ctx: ImportCtx,
  ticket: BhavinTicket,
  aliases: AliasConfig,
): Promise<MachineRef | null> {
  if (ticket.machineCode === null) return null;
  const past = ticket.entryType !== 'ordinary';
  return findMachine(ctx, ticket.machineCode, machineAliases(aliases), past);
}

/** The machine each `utility_loss` line names, by the code as the export wrote it. */
async function loadLineMachines(
  ctx: ImportCtx,
  ticket: BhavinTicket,
  aliases: AliasConfig,
): Promise<Map<string, string>> {
  const byAlias = machineAliases(aliases);
  const ids = new Map<string, string>();
  for (const event of ticket.events) {
    if (event.type !== 'utility_loss') continue;
    const machine = await findMachine(ctx, event.payload.machineCode, byAlias, true);
    if ([...ids.values()].includes(machine.id)) {
      throw new Error(`A plant event names machine ${machine.code} twice`);
    }
    ids.set(normalizeCode(event.payload.machineCode), machine.id);
  }
  return ids;
}

type PersonHit = { id: string; name: string };

/** Active people by normalised name, and by `P-` code (the first eight characters of their id, R9). */
async function peopleIndex(ctx: ImportCtx) {
  const byName = new Map<string, PersonHit[]>();
  const byCode = new Map<string, PersonHit[]>();
  const add = (map: Map<string, PersonHit[]>, key: string, hit: PersonHit) =>
    map.set(key, [...(map.get(key) ?? []), hit]);
  for (const row of await activePeople(ctx.client, ctx.tenantId)) {
    const hit = { id: row.id as string, name: row.name as string };
    add(byName, normalizeKey(hit.name), hit);
    add(byCode, personCode(hit.id).toLowerCase(), hit);
  }
  return { byName, byCode };
}

async function loadPeople(ctx: ImportCtx, ticket: BhavinTicket, aliases: AliasConfig) {
  const { byName, byCode } = await peopleIndex(ctx);
  const aliasBySource = new Map(
    Object.entries(aliases.people).map(([source, target]) => [
      normalizeKey(source),
      normalizeKey(target),
    ]),
  );
  const people = new Map<string, string>();
  const pendingPersons = new Map<string, PendingPerson>();
  for (const sourceName of names(ticket)) {
    const source = normalizeKey(sourceName);
    const target = aliasBySource.get(source) ?? source;
    const matches =
      byName.get(target) ?? (PERSON_CODE.test(target) ? byCode.get(target) : undefined) ?? [];
    if (matches.length > 1) throw new Error(`Ambiguous active person: ${target}`);
    if (matches.length === 1) {
      people.set(source, (matches[0] as { id: string }).id);
      continue;
    }
    if (aliasBySource.has(source)) throw new Error(`Unknown or inactive person alias: ${target}`);
    // A `P-` code names one existing person: unmatched (or an inactive person) it never makes a new one.
    if (PERSON_CODE.test(target)) throw new Error(`Unknown or inactive person code: ${target}`);
    const name = displayName(sourceName);
    const personId = await ensurePendingPerson(ctx.client, ctx.tenantId, name);
    people.set(source, personId);
    pendingPersons.set(source, { personId, name, createdByImport: true });
  }
  return { people, pendingPersons };
}

export async function loadTicketReferences(
  ctx: ImportCtx,
  ticket: BhavinTicket,
  aliases: AliasConfig,
  timeZone?: string,
): Promise<ReconcileReferences> {
  const machine = await loadMachine(ctx, ticket, aliases);
  const lineMachines = await loadLineMachines(ctx, ticket, aliases);
  const people = await loadPeople(ctx, ticket, aliases);
  const lists = await loadLists(ctx, ticket.entryType !== 'ordinary');
  const shifts = await loadShifts(ctx);
  const zone = timeZone ?? (await ctx.client.query('SHOW TIME ZONE')).rows[0].TimeZone;
  return {
    timeZone: zone as string,
    machine,
    lineMachines,
    ...people,
    ...lists,
    maintenanceAliases: new Map(
      Object.entries(aliases.maintenanceCodes).map(([source, target]) => [
        normalizeCode(source),
        normalizeCode(target),
      ]),
    ),
    shifts,
  };
}
