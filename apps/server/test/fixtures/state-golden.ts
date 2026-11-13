import type { Pool } from 'pg';

/** Fixed fake data for the byte-for-byte `/state` golden (ticket 04). */
export const GOLDEN_HOST = 'golden.localhost';
export const GOLDEN_USER = 'ravi';
export const GOLDEN_NOW = '2026-11-12T06:00:00.000Z';
export const GOLDEN_FILE = new URL('./state-golden.json', import.meta.url);

const id = (n: number): string => `30000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const TENANT = id(1);
const PERSON = id(2);
const LOGIN = id(3);

interface GoldenTicket {
  n: number;
  ref: string;
  kind: 'stopped' | 'support' | 'general';
  status: 'open' | 'working' | 'waiting';
  machine: number | null;
  severity: string;
  policy: number | null;
  reportedAt: string;
  channel?: string;
  urgent?: boolean;
  location?: string;
  workType?: string;
  startedAt?: string;
  lead?: boolean;
  responseMin?: number;
  waitReason?: string;
  waitingSpare?: string;
  expectedBackAt?: string;
  raisedLogin?: boolean;
  crit?: string;
  snapshot?: { code: string; category: string; cell: string; criticality: string };
  events: Array<[string, string, Record<string, unknown>?]>;
}

const MACHINES = [
  { n: 4, code: 'GW-1', category: 'VMC', cell: 'Cell-A', crit: 'A' },
  { n: 5, code: 'GW-2', category: 'HMC', cell: 'Cell-B', crit: 'B' },
  { n: 6, code: 'GW-3', category: 'Lathe', cell: 'Cell-C', crit: 'C' },
];
const snap = (m: number): GoldenTicket['snapshot'] => {
  const x = MACHINES[m - 4]!;
  return { code: x.code, category: x.category, cell: x.cell, criticality: x.crit };
};

const TICKETS: GoldenTicket[] = [
  {
    n: 21,
    ref: 'BD-9001',
    kind: 'stopped',
    status: 'open',
    machine: 4,
    severity: 'S1',
    policy: 11,
    reportedAt: '2026-11-12T05:50:00Z',
    crit: 'A',
    snapshot: snap(4),
    raisedLogin: true,
    events: [['2026-11-12T05:50:00Z', 'down']],
  },
  {
    n: 22,
    ref: 'BD-9002',
    kind: 'stopped',
    status: 'working',
    machine: 5,
    severity: 'S2',
    policy: 12,
    reportedAt: '2026-11-12T05:00:00Z',
    startedAt: '2026-11-12T05:10:00Z',
    lead: true,
    responseMin: 10,
    crit: 'B',
    snapshot: snap(5),
    raisedLogin: true,
    events: [
      ['2026-11-12T05:00:00Z', 'down'],
      ['2026-11-12T05:10:00Z', 'start'],
    ],
  },
  {
    n: 23,
    ref: 'WR-9003',
    kind: 'general',
    status: 'waiting',
    machine: null,
    severity: 'S3',
    policy: 13,
    reportedAt: '2026-11-11T22:00:00Z',
    startedAt: '2026-11-11T22:30:00Z',
    lead: true,
    urgent: true,
    location: 'Store',
    workType: 'Electrical',
    waitReason: 'spare',
    waitingSpare: 'Contactor',
    expectedBackAt: '2026-11-13T06:00:00Z',
    raisedLogin: true,
    events: [
      ['2026-11-11T22:00:00Z', 'down'],
      ['2026-11-11T22:30:00Z', 'start'],
      ['2026-11-11T23:00:00Z', 'pause', { reason: 'spare', pausesSla: true }],
    ],
  },
  {
    n: 24,
    ref: 'BD-9004',
    kind: 'support',
    status: 'open',
    machine: 6,
    severity: 'S3',
    policy: 13,
    reportedAt: '2026-11-12T04:00:00Z',
    channel: 'desk',
    crit: 'C',
    snapshot: snap(6),
    raisedLogin: true,
    events: [['2026-11-12T04:00:00Z', 'down']],
  },
  {
    n: 25,
    ref: 'WR-9005',
    kind: 'general',
    status: 'open',
    machine: null,
    severity: 'S4',
    policy: null,
    reportedAt: '2026-11-12T03:00:00Z',
    channel: 'backfill',
    location: 'Canteen',
    workType: 'Civil',
    events: [['2026-11-12T03:00:00Z', 'down']],
  },
];

/** Inserts the golden tenant with the superuser pool. */
export async function seedGolden(admin: Pool, passwordHash: string): Promise<void> {
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'golden', 'Golden Works')", [
    TENANT,
  ]);
  await admin.query(
    "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, 'Ravi Test', 'maintenance')",
    [PERSON, TENANT],
  );
  await admin.query(
    "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, 'ravi', $4, 'supervisor', false)",
    [LOGIN, TENANT, PERSON, passwordHash],
  );
  for (const m of MACHINES) {
    await admin.query(
      'INSERT INTO machine (id, tenant_id, code, category, cell, criticality) VALUES ($1, $2, $3, $4, $5, $6)',
      [id(m.n), TENANT, m.code, m.category, m.cell, m.crit],
    );
  }
  const policies: Array<[number, string, number, number]> = [
    [11, 'S1', 15, 120],
    [12, 'S2', 30, 240],
    [13, 'S3', 60, 480],
    [14, 'S4', 240, 1440],
  ];
  for (const [n, sev, ack, restore] of policies) {
    await admin.query(
      'INSERT INTO sla_policy (id, tenant_id, severity, ack_minutes, restore_minutes, business_hours_only) VALUES ($1, $2, $3, $4, $5, false)',
      [id(n), TENANT, sev, ack, restore],
    );
  }
  for (const t of TICKETS) await insertTicket(admin, t);
}

async function insertTicket(admin: Pool, t: GoldenTicket): Promise<void> {
  await admin.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, machine_id, machine_snapshot, location, work_type,
       urgent, problem, reported_at, reported_by_person_id, raised_login_id, raised_channel, started_at,
       lead_person_id, wait_reason, waiting_spare, expected_back_at, severity, criticality_snapshot,
       sla_policy_id, response_min, last_event_seq)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
    [
      id(t.n),
      TENANT,
      t.ref,
      t.kind,
      t.status,
      t.machine ? id(t.machine) : null,
      JSON.stringify(t.snapshot ?? {}),
      t.location ?? null,
      t.workType ?? null,
      t.urgent ?? false,
      `Golden ${t.ref}`,
      t.reportedAt,
      PERSON,
      t.raisedLogin ? LOGIN : null,
      t.channel ?? 'floor',
      t.startedAt ?? null,
      t.lead ? PERSON : null,
      t.waitReason ?? null,
      t.waitingSpare ?? null,
      t.expectedBackAt ?? null,
      t.severity,
      t.crit ?? null,
      t.policy ? id(t.policy) : null,
      t.responseMin ?? null,
      t.events.length,
    ],
  );
  let seq = 0;
  for (const [at, type, payload] of t.events) {
    seq += 1;
    await admin.query(
      `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at, login_id, acting_person_id, text, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        TENANT,
        id(t.n),
        seq,
        type,
        at,
        LOGIN,
        PERSON,
        `Golden ${t.ref}`,
        JSON.stringify(payload ?? {}),
      ],
    );
  }
}
