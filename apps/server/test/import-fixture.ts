import type { Pool } from 'pg';
import type { AliasConfig } from '../src/import/schema.js';

export const syntheticSource = 'argus.synthetic-bhavin/v1' as const;

export const syntheticIds = {
  tenant: '91000000-0000-0000-0000-000000000001',
  machine: '91000000-0000-0000-0000-000000000002',
  asha: '91000000-0000-0000-0000-000000000003',
  bina: '91000000-0000-0000-0000-000000000004',
  vendor: '91000000-0000-0000-0000-000000000005',
} as const;

const figures = {
  activeMin: 55,
  downAccMin: 60,
  downtimeMin: 60,
  followMin: null,
  handoverWaitMin: 0,
  repairMin: 55,
  responseMin: 5,
  vendorMin: 0,
  waitMin: 0,
};

export function makeStoredFigures(overrides: Partial<typeof figures> = {}) {
  return { ...figures, ...overrides };
}

/** A completely invented raw ticket; timestamps remain strings until schema parsing. */
const ordinaryTicket = {
  crew: [
    {
      joinedAt: '2026-11-01T10:05:00Z',
      leftAt: null,
      leftReason: null,
      person: 'SYNTH-LEAD',
      role: 'lead',
    },
    {
      joinedAt: '2026-11-01T10:30:00Z',
      leftAt: null,
      leftReason: null,
      person: 'Bina',
      role: 'support',
    },
  ],
  entryType: 'ordinary',
  events: [
    { at: '2026-11-01T10:00:00Z', by: 'SYNTH-LEAD', payload: {}, text: null, type: 'down' },
    { at: '2026-11-01T10:05:00Z', by: 'SYNTH-LEAD', payload: {}, text: null, type: 'start' },
    {
      at: '2026-11-01T10:30:00Z',
      by: 'Bina',
      payload: { role: 'support' },
      text: null,
      type: 'join',
    },
    {
      at: '2026-11-01T11:00:00Z',
      by: 'SYNTH-LEAD',
      payload: { kind: 'report' },
      text: 'Synthetic repair complete',
      type: 'close',
    },
  ],
  kind: 'stopped',
  legacyId: 'synthetic-legacy-0100',
  location: 'Cell-1',
  machineCode: 'SYNTH-MACHINE',
  parentRef: null,
  problem: 'Synthetic spindle alarm',
  ref: 'BD-0100',
  reportedAt: '2026-11-01T10:00:00Z',
  reportedByPerson: 'SYNTH-LEAD',
  reports: [
    {
      breakdownCategory: 'E',
      correctiveAction: 'Synthetic spindle reset',
      date: '2026-11-01',
      doneBy: ['SYNTH-LEAD'],
      downtimeMin: 60,
      handoverName: null,
      kind: 'breakdown',
      maintCode: 'SYNTH-MAINT',
      observedBy: 'Engineer',
      problem: 'Synthetic spindle alarm',
      repairMin: 55,
      responseMin: 5,
      rootCause: 'Synthetic cause',
      shiftCode: '1',
      spareUsed: null,
      submittedAt: '2026-11-01T11:00:00Z',
      submittedBy: 'SYNTH-LEAD',
      supportedBy: ['Bina'],
    },
  ],
  segments: [
    {
      endReason: 'close',
      endedAt: '2026-11-01T11:00:00Z',
      person: 'SYNTH-LEAD',
      role: 'lead',
      startedAt: '2026-11-01T10:05:00Z',
    },
    {
      endReason: 'close',
      endedAt: '2026-11-01T11:00:00Z',
      person: 'Bina',
      role: 'support',
      startedAt: '2026-11-01T10:30:00Z',
    },
  ],
  state: {
    assignedToPerson: null,
    cancelledAt: null,
    closeKind: 'report',
    closeNote: 'Synthetic repair complete',
    closedAt: '2026-11-01T11:00:00Z',
    closedByPerson: 'SYNTH-LEAD',
    expectedBackAt: null,
    handedOver: false,
    handoverSince: null,
    kindUpgradedAt: null,
    leadPerson: 'SYNTH-LEAD',
    machineRunningAt: null,
    machineStoppedAt: null,
    pausedByPerson: null,
    segmentStartedAt: '2026-11-01T10:05:00Z',
    selfStarted: false,
    startedAt: '2026-11-01T10:05:00Z',
    transferToPerson: null,
    transferToShift: null,
    transfers: 0,
    waitReason: null,
    waitSince: null,
    waitingSpare: null,
  },
  status: 'closed',
  storedFigures: makeStoredFigures(),
  workType: 'breakdown',
};
export function makeOrdinaryTicket<T extends Record<string, unknown> = Record<string, never>>(
  overrides?: T,
) {
  return { ...structuredClone(ordinaryTicket), ...overrides };
}

function makeAliases() {
  return {
    machines: { 'SYNTH-MACHINE': 'M-1' },
    maintenanceCodes: { 'SYNTH-MAINT': 'M' },
    people: { 'SYNTH-LEAD': 'Asha' },
  };
}

export function makeSyntheticExport(
  tickets: unknown[] = [makeOrdinaryTicket()],
  aliases: AliasConfig = makeAliases(),
) {
  return { aliases, source: syntheticSource, tickets };
}

/** Complete synthetic reference data; keys match normalizeKey/normalizeCode lookups. */
export function makeReconcileReferences() {
  return {
    timeZone: 'UTC',
    machine: { id: syntheticIds.machine, code: 'M-1', category: 'CNC', cell: 'Cell-1' },
    people: new Map([
      ['synth-lead', syntheticIds.asha],
      ['asha', syntheticIds.asha],
      ['bina', syntheticIds.bina],
    ]),
    workTypes: new Map([['BREAKDOWN', { code: 'breakdown' }]]),
    locations: new Map([['CELL-1', { code: 'Cell-1' }]]),
    waitReasons: new Map([['SPARE', { code: 'spare', isVendor: true, pausesSla: true }]]),
    breakdownCategories: new Map([['E', { code: 'E' }]]),
    observedBy: new Map([['ENGINEER', { code: 'Engineer' }]]),
    maintenanceCodes: new Map([['M', { code: 'M' }]]),
    maintenanceAliases: new Map([['SYNTH-MAINT', 'M']]),
    shifts: new Map([
      ['1', { code: '1', startsAt: '08:00', endsAt: '18:30', crossesMidnight: false }],
      ['2', { code: '2', startsAt: '18:30', endsAt: '08:00', crossesMidnight: true }],
    ]),
    pendingPersons: new Map<string, { personId: string; name: string; createdByImport: true }>(),
  };
}

/** Seeds only invented configuration and people into a disposable test database. */
export async function seedSyntheticTenant(pool: Pool): Promise<void> {
  const ids = syntheticIds;
  await pool.query(
    "INSERT INTO tenant (id, slug, name, time_zone) VALUES ($1, 'synthetic', 'Synthetic Import Tenant', 'UTC')",
    [ids.tenant],
  );
  await pool.query(
    "INSERT INTO machine (id, tenant_id, code, category, cell) VALUES ($1, $2, 'M-1', 'CNC', 'Cell-1')",
    [ids.machine, ids.tenant],
  );
  await pool.query(
    `INSERT INTO person (id, tenant_id, name, team, kind) VALUES
       ($1, $4, 'Asha', 'maintenance', 'staff'),
       ($2, $4, 'Bina', 'maintenance', 'staff'),
       ($3, $4, 'Synthetic Vendor', 'vendor', 'vendor')`,
    [ids.asha, ids.bina, ids.vendor, ids.tenant],
  );
  await pool.query(
    `INSERT INTO list_item (tenant_id, list, code, label, is_vendor, pauses_sla)
       SELECT $1, v.list, v.code, v.label, v.is_vendor, v.pauses_sla FROM (VALUES
         ('maint_code', 'M', 'Synthetic maintenance', false, false),
         ('breakdown_category', 'E', 'Synthetic category', false, false),
         ('observed_by', 'Engineer', 'Synthetic observer', false, false),
         ('work_type', 'breakdown', 'Synthetic work', false, false),
         ('location', 'Cell-1', 'Synthetic location', false, false),
         ('wait_reason', 'spare', 'Synthetic spare wait', true, true)
       ) AS v(list, code, label, is_vendor, pauses_sla)`,
    [ids.tenant],
  );
  await pool.query(
    `INSERT INTO shift (tenant_id, code, name, starts_at, ends_at, crosses_midnight) VALUES
       ($1, '1', 'Synthetic shift 1', '08:00', '18:30', false),
       ($1, '2', 'Synthetic shift 2', '18:30', '08:00', true)`,
    [ids.tenant],
  );
}
