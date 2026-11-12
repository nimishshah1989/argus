import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

/**
 * The fake cosmos used by the e2e stack. Every id is fixed so specs can reference
 * machines/people without reading the database back. Nothing here is real data.
 */
export const API_PORT = 3001;
export const WEB_PORT = 3000;
export const API_URL = process.env.E2E_API_URL ?? `http://127.0.0.1:${API_PORT}`;
export const WEB_URL = process.env.E2E_WEB_URL ?? `http://127.0.0.1:${WEB_PORT}`;

export const E2E_PASSWORD = 'correct-horse-battery';

export const TENANT = {
  id: '10000000-0000-0000-0000-000000000001',
  slug: 'cosmos',
  name: 'Cosmos',
} as const;

export const SEGMENT = {
  id: '10000000-0000-0000-0000-000000000002',
  code: 'CNC',
  name: 'CNC',
} as const;

export interface MachineFixture {
  id: string;
  code: string;
  category: string;
  cell: string;
}

/** VC-1..VC-4 carry the specs (one machine each per project), VC-5/VC-6 are spares. */
export const MACHINES: MachineFixture[] = [
  { id: '10000000-0000-0000-0000-000000000003', code: 'VC-1', category: 'VMC', cell: 'Cell-1' },
  { id: '10000000-0000-0000-0000-000000000004', code: 'VC-2', category: 'VMC', cell: 'Cell-1' },
  { id: '10000000-0000-0000-0000-000000000005', code: 'VC-3', category: 'HMC', cell: 'Cell-2' },
  { id: '10000000-0000-0000-0000-000000000006', code: 'VC-4', category: 'HMC', cell: 'Cell-2' },
  { id: '10000000-0000-0000-0000-000000000007', code: 'VC-5', category: 'VMC', cell: 'Cell-3' },
  { id: '10000000-0000-0000-0000-000000000008', code: 'VC-6', category: 'HMC', cell: 'Cell-3' },
  { id: '10000000-0000-0000-0000-000000000013', code: 'VC-7', category: 'VMC', cell: 'Cell-4' },
  { id: '10000000-0000-0000-0000-000000000014', code: 'VC-8', category: 'HMC', cell: 'Cell-4' },
];

const PEOPLE = [
  {
    id: '10000000-0000-0000-0000-000000000009',
    name: 'Asha',
    team: 'maintenance',
    title: 'Technician',
  },
  {
    id: '10000000-0000-0000-0000-00000000000a',
    name: 'Bina',
    team: 'maintenance',
    title: 'Technician',
  },
  {
    id: '10000000-0000-0000-0000-00000000000b',
    name: 'Omi',
    team: 'production',
    title: 'Operator',
  },
  {
    id: '10000000-0000-0000-0000-000000000011',
    name: 'Meera',
    team: 'maintenance',
    title: 'Admin',
  },
] as const;

const LOGINS = [
  {
    id: '10000000-0000-0000-0000-00000000000d',
    personId: PEOPLE[0].id,
    username: 'asha',
    role: 'technician',
    shared: false,
    cell: null,
  },
  {
    id: '10000000-0000-0000-0000-00000000000e',
    personId: PEOPLE[1].id,
    username: 'bina',
    role: 'technician',
    shared: false,
    cell: null,
  },
  {
    id: '10000000-0000-0000-0000-00000000000f',
    personId: PEOPLE[2].id,
    username: 'op',
    role: 'operator',
    shared: false,
    cell: null,
  },
  {
    id: '10000000-0000-0000-0000-000000000010',
    personId: null,
    username: 'cell-phone',
    role: 'operator',
    shared: true,
    cell: 'Cell-1',
  },
  {
    id: '10000000-0000-0000-0000-000000000012',
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
export function seedStatements(passwordHash: string): SeedStatement[] {
  return [
    {
      text: 'INSERT INTO tenant (id, slug, name) VALUES ($1, $2, $3)',
      values: [TENANT.id, TENANT.slug, TENANT.name],
    },
    {
      text: 'INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, $3, $4, 0)',
      values: [SEGMENT.id, TENANT.id, SEGMENT.code, SEGMENT.name],
    },
    ...MACHINES.map((machine) => ({
      text: 'INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES ($1, $2, $3, $4, $5, $6)',
      values: [machine.id, TENANT.id, machine.code, SEGMENT.id, machine.category, machine.cell],
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
export function machineFor(suite: 'floor' | 'desk' | 'tags', projectName: string): MachineFixture {
  const index =
    (suite === 'floor' ? 0 : suite === 'desk' ? 2 : 4) + (projectName === 'phone' ? 1 : 0);
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

async function apiJson<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
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
        ? { machineId, problem }
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
