import { randomUUID } from 'node:crypto';
import {
  SEGMENT,
  TENANT,
  apiFetch,
  scopedId,
  type MachineFixture,
  type SeedStatement,
} from './fixtures.js';

/**
 * The extra cast for the action matrix: one login per role the base cosmos lacks (supervisor,
 * head, plant head, board) and two machines of their own. Every name and id is fake.
 */
const ACTION_PEOPLE = [
  {
    id: scopedId('10000000-0000-0000-0000-00000000001c'),
    name: 'Sara',
    team: 'maintenance',
    title: 'Supervisor',
  },
  {
    id: scopedId('10000000-0000-0000-0000-00000000001d'),
    name: 'Hari',
    team: 'maintenance',
    title: 'Head',
  },
  {
    id: scopedId('10000000-0000-0000-0000-00000000001e'),
    name: 'Pia',
    team: 'production',
    title: 'Plant head',
  },
  {
    id: scopedId('10000000-0000-0000-0000-00000000001f'),
    name: 'Bo',
    team: 'production',
    title: 'Board',
  },
] as const;

const ACTION_LOGINS = [
  { id: '20', person: 0, username: 'sup', role: 'supervisor' },
  { id: '21', person: 1, username: 'head', role: 'head' },
  { id: '22', person: 2, username: 'ph', role: 'plant_head' },
  { id: '23', person: 3, username: 'brd', role: 'board' },
] as const;

/** Machine A holds the open stopped ticket, machine B the working one (one set per worker). */
const ACTION_MACHINES: MachineFixture[] = [
  {
    id: scopedId('10000000-0000-0000-0000-000000000018'),
    code: 'VC-11',
    category: 'VMC',
    cell: 'Cell-6',
  },
  {
    id: scopedId('10000000-0000-0000-0000-000000000019'),
    code: 'VC-12',
    category: 'HMC',
    cell: 'Cell-6',
  },
];

export function actionMachines(): { a: MachineFixture; b: MachineFixture } {
  const [a, b] = ACTION_MACHINES as [MachineFixture, MachineFixture];
  return { a, b };
}

export function actionSeedStatements(passwordHash: string): SeedStatement[] {
  return [
    ...ACTION_MACHINES.map((machine) => ({
      text: 'INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES ($1, $2, $3, $4, $5, $6)',
      values: [machine.id, TENANT.id, machine.code, SEGMENT.id, machine.category, machine.cell],
    })),
    ...ACTION_PEOPLE.map((person) => ({
      text: 'INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $2, $3, $4, $5)',
      values: [person.id, TENANT.id, person.name, person.team, person.title],
    })),
    ...ACTION_LOGINS.map((login) => ({
      text: 'INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, $4, $5, $6, false)',
      values: [
        scopedId(`10000000-0000-0000-0000-0000000000${login.id}`),
        TENANT.id,
        ACTION_PEOPLE[login.person].id,
        login.username,
        passwordHash,
        login.role,
      ],
    })),
  ];
}

/** Sends one command as the logged-in token's person (a personal login must act as itself). */
export async function commandViaApi(
  token: string,
  ticketId: string,
  action: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await apiFetch(`/api/v1/tickets/${ticketId}/${action}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': randomUUID(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${action} ${ticketId} failed: ${res.status} ${await res.text()}`);
}

/** The signed-in login as the API reports it; `actingPersonId` is the person commands name. */
export async function getJson<T>(token: string, path: string): Promise<T> {
  const res = await apiFetch(path, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}
