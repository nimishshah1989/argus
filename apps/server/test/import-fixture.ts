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
      leftAt: '2026-11-01T11:00:00Z',
      leftReason: 'close',
      person: 'SYNTH-LEAD',
      role: 'lead',
    },
    {
      joinedAt: '2026-11-01T10:30:00Z',
      leftAt: '2026-11-01T11:00:00Z',
      leftReason: 'close',
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
  location: null,
  machineCode: 'SYNTH-MACHINE',
  parentRef: null,
  problem: 'Synthetic spindle alarm',
  ref: 'BD-0100',
  reportedAt: '2026-11-01T10:00:00Z',
  reportedByPerson: 'SYNTH-LEAD',
  reports: [
    {
      breakdownCategory: 'M',
      correctiveAction: 'Synthetic spindle reset',
      date: '2026-11-01',
      doneBy: ['SYNTH-LEAD'],
      downtimeMin: 60,
      handoverName: null,
      kind: 'breakdown',
      maintCode: 'SYNTH-MAINT',
      observedBy: 'Asha',
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
  workType: null,
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

/** Seeds only invented configuration and people into a disposable test database. */
export async function seedSyntheticTenant(pool: Pool): Promise<void> {
  const ids = syntheticIds;
  await pool.query(
    `INSERT INTO tenant (id, slug, name, time_zone)
       VALUES ($1, 'synthetic', 'Synthetic Import Tenant', 'UTC');
     INSERT INTO machine (id, tenant_id, code, category, cell)
       VALUES ($2, $1, 'M-1', 'Synthetic category', 'Synthetic cell');
     INSERT INTO person (id, tenant_id, name, team, kind) VALUES
       ($3, $1, 'Asha', 'maintenance', 'staff'),
       ($4, $1, 'Bina', 'maintenance', 'staff'),
       ($5, $1, 'Synthetic Vendor', 'vendor', 'vendor');
     INSERT INTO list_item (tenant_id, list, code, label, is_vendor)
       SELECT $1, v.list, v.code, v.label, v.is_vendor FROM (VALUES
         ('maint_code', 'M', 'Synthetic maintenance', false),
         ('breakdown_category', 'M', 'Synthetic category', false),
         ('observed_by', 'Asha', 'Synthetic observer', false),
         ('work_type', 'synthetic-work', 'Synthetic work', false),
         ('location', 'Synthetic cell', 'Synthetic location', false),
         ('wait_reason', 'synthetic-wait', 'Synthetic wait', false),
         ('wait_reason', 'synthetic-vendor', 'Synthetic vendor wait', true)
       ) AS v(list, code, label, is_vendor);
     INSERT INTO shift (tenant_id, code, name, starts_at, ends_at, crosses_midnight) VALUES
       ($1, '1', 'Synthetic shift 1', '08:00', '18:30', false),
       ($1, '2', 'Synthetic shift 2', '18:30', '08:00', true);`,
    [ids.tenant, ids.machine, ids.asha, ids.bina, ids.vendor],
  );
}
