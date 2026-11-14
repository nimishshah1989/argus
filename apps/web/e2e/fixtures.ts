import { randomUUID } from 'node:crypto';
import { request } from 'node:http';
import { expect, type Page } from '@playwright/test';

/**
 * The fake cosmos used by the e2e stack. Every id is fixed so specs can reference
 * machines/people without reading the database back; ids are scoped per Playwright worker.
 * Nothing here is real data.
 */
export const API_PORT = 3001;
export const WEB_PORT = 3000;
export const API_URL = process.env.E2E_API_URL ?? `http://127.0.0.1:${API_PORT}`;
export const WEB_URL = process.env.E2E_WEB_URL ?? `http://127.0.0.1:${WEB_PORT}`;

export const E2E_PASSWORD = 'correct-horse-battery';

export const WORKER = Number(process.env.TEST_WORKER_INDEX ?? '0');

/** The fixture id with its first 8 hex digits replaced by this worker's number. */
export function scopedId(base: string): string {
  return (0x20000000 + WORKER).toString(16) + base.slice(8);
}

export const TENANT = {
  id: scopedId('10000000-0000-0000-0000-000000000001'),
  slug: `e2e-w${WORKER}`,
  name: 'Cosmos',
} as const;

export const TENANT_WEB_URL = `http://${TENANT.slug}.localhost:${WEB_PORT}`;
export const API_HOST = `${TENANT.slug}.localhost`;

export const SEGMENT = {
  id: scopedId('10000000-0000-0000-0000-000000000002'),
  code: 'CNC',
  name: 'CNC',
} as const;

export interface MachineFixture {
  id: string;
  code: string;
  category: string;
  cell: string;
}

/** Machine ownership by suite: floor, desk, Settings, board, then SLA. */
export const MACHINES: MachineFixture[] = [
  {
    id: scopedId('10000000-0000-0000-0000-000000000003'),
    code: 'VC-1',
    category: 'VMC',
    cell: 'Cell-1',
  },
  {
    id: scopedId('10000000-0000-0000-0000-000000000004'),
    code: 'VC-2',
    category: 'VMC',
    cell: 'Cell-1',
  },
  {
    id: scopedId('10000000-0000-0000-0000-000000000005'),
    code: 'VC-3',
    category: 'HMC',
    cell: 'Cell-2',
  },
  {
    id: scopedId('10000000-0000-0000-0000-000000000006'),
    code: 'VC-4',
    category: 'HMC',
    cell: 'Cell-2',
  },
  {
    id: scopedId('10000000-0000-0000-0000-000000000007'),
    code: 'VC-5',
    category: 'VMC',
    cell: 'Cell-3',
  },
  {
    id: scopedId('10000000-0000-0000-0000-000000000008'),
    code: 'VC-6',
    category: 'HMC',
    cell: 'Cell-3',
  },
  {
    id: scopedId('10000000-0000-0000-0000-000000000013'),
    code: 'VC-7',
    category: 'VMC',
    cell: 'Cell-4',
  },
  {
    id: scopedId('10000000-0000-0000-0000-000000000014'),
    code: 'VC-8',
    category: 'HMC',
    cell: 'Cell-4',
  },
  {
    id: scopedId('10000000-0000-0000-0000-000000000016'),
    code: 'VC-9',
    category: 'VMC',
    cell: 'Cell-5',
  },
  {
    id: scopedId('10000000-0000-0000-0000-000000000017'),
    code: 'VC-10',
    category: 'HMC',
    cell: 'Cell-5',
  },
];

/** The floor spec's own group (ticket 15): one machine per spec slot per project, so nothing else raises on them. */
export const FLOOR_GROUP = {
  id: scopedId('10000000-0000-0000-0000-000000000018'),
  code: 'FL',
  name: 'Floor line',
} as const;
const FLOOR_SLOTS = 8;
const PROJECTS = ['chromium', 'phone', 'gujarati'];

const FLOOR_MACHINES: MachineFixture[] = Array.from({ length: FLOOR_SLOTS * 3 }, (_, i) => ({
  id: scopedId(`10000000-0000-0000-0001-${String(i).padStart(12, '0')}`),
  code: `FL-1${Math.floor(i / 3) + 1}${i % 3}`,
  category: 'VMC',
  cell: 'Cell-6',
}));

/** FL-<slot><project>, e.g. FL-110 is slot 1 for chromium; each code is unique under a search. */
export function floorMachine(slot: number, projectName: string): MachineFixture {
  const code = `FL-1${slot}${Math.max(0, PROJECTS.indexOf(projectName))}`;
  const machine = FLOOR_MACHINES.find((m) => m.code === code);
  if (!machine) throw new Error(`No floor machine ${code}`);
  return machine;
}

const PEOPLE = [
  {
    id: scopedId('10000000-0000-0000-0000-000000000009'),
    name: 'Asha',
    team: 'maintenance',
    title: 'Technician',
  },
  {
    id: scopedId('10000000-0000-0000-0000-00000000000a'),
    name: 'Bina',
    team: 'maintenance',
    title: 'Technician',
  },
  {
    id: scopedId('10000000-0000-0000-0000-00000000000b'),
    name: 'Omi',
    team: 'production',
    title: 'Operator',
  },
  {
    id: scopedId('10000000-0000-0000-0000-000000000011'),
    name: 'Meera',
    team: 'maintenance',
    title: 'Admin',
  },
] as const;

const LOGINS = [
  {
    id: scopedId('10000000-0000-0000-0000-00000000000d'),
    personId: PEOPLE[0].id,
    username: 'asha',
    role: 'technician',
    shared: false,
    cell: null,
  },
  {
    id: scopedId('10000000-0000-0000-0000-00000000000e'),
    personId: PEOPLE[1].id,
    username: 'bina',
    role: 'technician',
    shared: false,
    cell: null,
  },
  {
    id: scopedId('10000000-0000-0000-0000-00000000000f'),
    personId: PEOPLE[2].id,
    username: 'op',
    role: 'operator',
    shared: false,
    cell: null,
  },
  {
    id: scopedId('10000000-0000-0000-0000-000000000010'),
    personId: null,
    username: 'cell-phone',
    role: 'operator',
    shared: true,
    cell: 'Cell-1',
  },
  {
    id: scopedId('10000000-0000-0000-0000-000000000012'),
    personId: PEOPLE[3].id,
    username: 'admin',
    role: 'admin',
    shared: false,
    cell: null,
  },
] as const;

const LISTS = [
  { list: 'wait_reason', code: 'spare', label: 'Spare part', sort: 0, isVendor: false },
  { list: 'wait_reason', code: 'vendor', label: 'Vendor service', sort: 1, isVendor: true },
  { list: 'quick_problem', code: 'spindle', label: 'Spindle alarm', sort: 0, isVendor: false },
  { list: 'quick_problem', code: 'belt', label: 'Belt slipping', sort: 1, isVendor: false },
  { list: 'breakdown_category', code: 'E', label: 'Electrical', sort: 0, isVendor: false },
  { list: 'maint_code', code: 'M', label: 'Mechanical', sort: 0, isVendor: false },
  { list: 'work_type', code: 'preventive', label: 'Preventive', sort: 0, isVendor: false },
] as const;

export interface SeedStatement {
  text: string;
  values: unknown[];
}

/** The seeded cosmos: one tenant, one segment, machines, people, logins, lists, BD refs. */
export function seedStatements(
  passwordHash: string,
  language: 'en' | 'gu' = 'en',
): SeedStatement[] {
  return [
    {
      text: 'INSERT INTO tenant (id, slug, name, language) VALUES ($1, $2, $3, $4)',
      values: [TENANT.id, TENANT.slug, TENANT.name, language],
    },
    {
      text: 'INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, $3, $4, 0)',
      values: [SEGMENT.id, TENANT.id, SEGMENT.code, SEGMENT.name],
    },
    {
      text: "INSERT INTO shift (id, tenant_id, code, name, starts_at, ends_at) VALUES ($1, $2, 'e2e', 'E2E business hours', '00:00', '23:59')",
      values: [scopedId('10000000-0000-0000-0000-000000000015'), TENANT.id],
    },
    ...MACHINES.map((machine) => ({
      text: 'INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES ($1, $2, $3, $4, $5, $6)',
      values: [machine.id, TENANT.id, machine.code, SEGMENT.id, machine.category, machine.cell],
    })),
    {
      text: 'INSERT INTO machine_group (id, tenant_id, segment_id, code, name) VALUES ($1, $2, $3, $4, $5)',
      values: [FLOOR_GROUP.id, TENANT.id, SEGMENT.id, FLOOR_GROUP.code, FLOOR_GROUP.name],
    },
    ...FLOOR_MACHINES.map((machine) => ({
      text: 'INSERT INTO machine (id, tenant_id, code, segment_id, group_id, category, cell) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      values: [
        machine.id,
        TENANT.id,
        machine.code,
        SEGMENT.id,
        FLOOR_GROUP.id,
        machine.category,
        machine.cell,
      ],
    })),
    ...PEOPLE.map((person) => ({
      text: 'INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $2, $3, $4, $5)',
      values: [person.id, TENANT.id, person.name, person.team, person.title],
    })),
    ...LOGINS.map((login) => ({
      text: 'INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared, cell) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      values: [
        login.id,
        TENANT.id,
        login.personId,
        login.username,
        passwordHash,
        login.role,
        login.shared,
        login.cell,
      ],
    })),
    ...LISTS.map((item) => ({
      text: 'INSERT INTO list_item (tenant_id, list, code, label, sort, active, is_vendor, pauses_sla) VALUES ($1, $2, $3, $4, $5, true, $6, false)',
      values: [TENANT.id, item.list, item.code, item.label, item.sort, item.isVendor],
    })),
    {
      text: "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 150)",
      values: [TENANT.id],
    },
  ];
}

/** One machine per spec per project so both projects can run in parallel. */
export function machineFor(suite: 'floor' | 'desk', projectName: string): MachineFixture {
  const index = (suite === 'floor' ? 0 : 2) + (projectName === 'phone' ? 1 : 0);
  const machine = MACHINES[index];
  if (!machine) throw new Error(`No machine fixture for ${suite}/${projectName}`);
  return machine;
}

interface LoginBody {
  token: string;
}

interface RaisedTicket {
  id: string;
  ref: string;
}

export interface ApiInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/** Node's fetch drops a Host override, so API calls go through node:http with this worker's tenant host. */
export function apiFetch(path: string, init: ApiInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = request(
      new URL(path, API_URL),
      { method: init.method ?? 'GET', headers: { ...init.headers, host: API_HOST } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          resolve(
            new Response(status === 204 || status === 304 ? null : Buffer.concat(chunks), {
              status,
              headers: { 'content-type': res.headers['content-type'] ?? '' },
            }),
          );
        });
      },
    );
    req.on('error', reject);
    req.end(init.body);
  });
}

async function apiJson<T>(path: string, init: ApiInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/** Signs in against the API (the UI session is separate). */
export async function apiLogin(username: string): Promise<string> {
  const body = await apiJson<LoginBody>('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: E2E_PASSWORD }),
  });
  return body.token;
}

/** Raises a stopped ticket through the real API, so the desk spec does not depend on the floor form. */
export async function raiseTicketViaApi(
  token: string,
  machineId: string | null,
  problem: string,
  kind: 'stopped' | 'support' = 'stopped',
): Promise<RaisedTicket> {
  const body = await apiJson<{ ticket: RaisedTicket }>('/api/v1/tickets', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': randomUUID(),
    },
    body: JSON.stringify(
      machineId
        ? { kind, machineId, problem }
        : { kind: 'general', location: 'Workshop', workType: 'Tag test', problem },
    ),
  });
  return body.ticket;
}

/** Signs in through the real login screen and waits until the floor is rendered. */
export async function signIn(page: Page, username = 'asha'): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Report a problem' })).toBeVisible();
}
