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

function displayName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

function addCode<T extends CodeReference>(map: Map<string, T>, key: string, value: T): void {
  const normalized = normalizeCode(key);
  if (map.has(normalized)) throw new Error(`Duplicate normalized active code: ${key}`);
  map.set(normalized, value);
}

async function loadLists(ctx: ImportCtx): Promise<{
  workTypes: Map<string, CodeReference>;
  locations: Map<string, CodeReference>;
  waitReasons: Map<string, WaitReasonReference>;
  breakdownCategories: Map<string, CodeReference>;
  observedBy: Map<string, CodeReference>;
  maintenanceCodes: Map<string, CodeReference>;
}> {
  const result = await ctx.client.query(
    `SELECT list, code, is_vendor, pauses_sla FROM list_item
     WHERE tenant_id = $1 AND active AND list = ANY($2)`,
    [ctx.tenantId, [...LISTS]],
  );
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
  for (const row of result.rows) {
    const code = row.code as string;
    addCode(targets[row.list as keyof typeof targets], code, {
      code,
      ...(row.list === 'wait_reason'
        ? { isVendor: row.is_vendor as boolean, pausesSla: row.pauses_sla as boolean }
        : {}),
    });
  }
  return maps;
}

async function loadShifts(ctx: ImportCtx): Promise<Map<string, ShiftReference>> {
  const result = await ctx.client.query(
    'SELECT code, starts_at, ends_at, crosses_midnight FROM shift WHERE tenant_id = $1',
    [ctx.tenantId],
  );
  const shifts = new Map<string, ShiftReference>();
  for (const row of result.rows) {
    addCode(shifts, row.code as string, {
      code: row.code as string,
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
      crossesMidnight: row.crosses_midnight as boolean,
    });
  }
  return shifts;
}

async function loadMachine(ctx: ImportCtx, ticket: BhavinTicket, aliases: AliasConfig) {
  if (ticket.machineCode === null) return null;
  const aliasesBySource = new Map(
    Object.entries(aliases.machines).map(([source, target]) => [
      normalizeCode(source),
      normalizeCode(target),
    ]),
  );
  const source = normalizeCode(ticket.machineCode);
  const code = aliasesBySource.get(source) ?? source;
  const result = await ctx.client.query(
    'SELECT id, code, category, cell, criticality FROM machine WHERE tenant_id = $1 AND code = $2 AND status = $3',
    [ctx.tenantId, code, 'active'],
  );
  if (result.rows.length !== 1) throw new Error(`Unknown or inactive machine: ${code}`);
  return result.rows[0] as {
    id: string;
    code: string;
    category: string | null;
    cell: string | null;
    criticality: 'A' | 'B' | 'C' | null;
  };
}

async function loadPeople(ctx: ImportCtx, ticket: BhavinTicket, aliases: AliasConfig) {
  const existing = await ctx.client.query(
    'SELECT id, name FROM person WHERE tenant_id = $1 AND active',
    [ctx.tenantId],
  );
  const byName = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of existing.rows) {
    const key = normalizeKey(row.name as string);
    byName.set(key, [
      ...(byName.get(key) ?? []),
      { id: row.id as string, name: row.name as string },
    ]);
  }
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
    const matches = byName.get(target) ?? [];
    if (matches.length > 1) throw new Error(`Ambiguous active person: ${target}`);
    if (matches.length === 1) {
      people.set(source, (matches[0] as { id: string }).id);
      continue;
    }
    if (aliasBySource.has(source)) throw new Error(`Unknown or inactive person alias: ${target}`);
    const name = displayName(sourceName);
    const inserted = await ctx.client.query(
      `INSERT INTO person (tenant_id, name, team, kind, active, pending)
       VALUES ($1, $2, 'production', 'production', true, true) RETURNING id`,
      [ctx.tenantId, name],
    );
    const personId = inserted.rows[0].id as string;
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
  const people = await loadPeople(ctx, ticket, aliases);
  const lists = await loadLists(ctx);
  const shifts = await loadShifts(ctx);
  const zone = timeZone ?? (await ctx.client.query('SHOW TIME ZONE')).rows[0].TimeZone;
  return {
    timeZone: zone as string,
    machine,
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
