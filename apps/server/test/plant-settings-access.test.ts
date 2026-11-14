import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  GROUP_A,
  GROUP_B,
  ITEM_A,
  ITEM_B,
  TERM_A,
  TERM_B,
  M_B,
  M_FREE,
  M_USED,
  ROLES,
  SEG_A,
  SEG_B,
  SHIFT_A,
  SHIFT_B,
  startFixture,
  type Fixture,
} from './plant-settings-fixture.js';

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
}, 180_000);
afterAll(async () => f.stop());

const auditCount = async () =>
  Number((await f.admin.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n);

// Every write a generated settings screen makes, one per resource and verb.
const RESOURCE_PATHS = [
  'machines',
  'segments',
  'groups',
  'shifts',
  'settings/lists/wait_reason',
  'settings/glossary',
];

const WRITES: Array<[string, string, object | undefined]> = [
  ['POST', '/api/v1/machines', { code: 'NEW-1' }],
  ['PUT', `/api/v1/machines/${M_FREE}`, { cell: 'Cell 7' }],
  ['PUT', `/api/v1/machines/${M_FREE}`, { active: false }],
  ['POST', '/api/v1/settings/lists/wait_reason', { code: 'new', label: 'New' }],
  ['PUT', `/api/v1/settings/lists/wait_reason/${ITEM_A}`, { active: false }],
  ['POST', '/api/v1/settings/glossary', { source: 'નવું', english: 'new' }],
  ['PUT', `/api/v1/settings/glossary/${TERM_A}`, { english: 'changed' }],
  ['POST', '/api/v1/segments', { code: 'NEW', name: 'New' }],
  ['PUT', `/api/v1/segments/${SEG_A}`, { showOnBoard: false }],
  ['POST', '/api/v1/groups', { segmentId: SEG_A, code: 'NEW', name: 'New' }],
  ['PUT', `/api/v1/groups/${GROUP_A}`, { hidden: true }],
  ['POST', '/api/v1/shifts', { code: 'NIGHT', name: 'Night', startsAt: '18:29', endsAt: '05:00' }],
  ['PUT', `/api/v1/shifts/${SHIFT_A}`, { name: 'Day shift' }],
  ['PUT', `/api/v1/machines/${M_FREE}/criticality`, { criticality: 'A' }],
];

describe('who may change machines, segments, groups and shifts (DOMAIN §3)', () => {
  it.each(ROLES.filter((r) => r !== 'head' && r !== 'admin'))(
    '%s is refused every write, and nothing is written or audited',
    async (role) => {
      const before = await auditCount();
      for (const [method, url, payload] of WRITES) {
        const res = await f.call(method, url, f.tokens[role]!, payload);
        expect(res.statusCode, `${role} ${method} ${url}`).toBe(403);
      }
      expect(await auditCount()).toBe(before);
      const machine = await f.admin.query('SELECT cell, status FROM machine WHERE id = $1', [
        M_FREE,
      ]);
      expect(machine.rows[0]).toEqual({ cell: 'Cell 1', status: 'active' });
    },
  );

  it('an unauthenticated caller gets 401 on a write', async () => {
    const res = await f.app.inject({
      method: 'POST',
      url: '/api/v1/machines',
      headers: { host: 'plant-a.localhost', 'content-type': 'application/json' },
      payload: { code: 'X-1' },
    });
    expect(res.statusCode).toBe(401);
  });

  it.each(ROLES.filter((r) => r !== 'head' && r !== 'admin'))(
    '%s is refused every settings read (the floor and the desk read /config)',
    async (role) => {
      for (const path of [...RESOURCE_PATHS, `machines/${M_FREE}/moves`]) {
        const res = await f.call('GET', `/api/v1/${path}`, f.tokens[role]!);
        expect(res.statusCode, `${role} ${path}`).toBe(403);
      }
      expect((await f.call('GET', '/api/v1/config', f.tokens[role]!)).statusCode).toBe(200);
    },
  );

  it.each(['head', 'admin'])('%s may list every resource', async (role) => {
    for (const path of RESOURCE_PATHS) {
      const res = await f.call('GET', `/api/v1/${path}`, f.tokens[role]!);
      expect(res.statusCode, path).toBe(200);
      expect(res.json().items.length, path).toBeGreaterThan(0);
      expect(res.json().nextCursor, path).toBeNull();
    }
  });
});

describe('tenancy: plant A cannot see or change plant B', () => {
  it('lists only its own rows', async () => {
    for (const path of RESOURCE_PATHS) {
      const ids = (await f.call('GET', `/api/v1/${path}`, f.tokens.admin!))
        .json()
        .items.map((r: { id: string }) => r.id);
      for (const other of [M_B, SEG_B, GROUP_B, SHIFT_B, ITEM_B, TERM_B]) {
        expect(ids, path).not.toContain(other);
      }
    }
  });

  it("answers 404 and changes nothing for the other plant's ids", async () => {
    const attempts: Array<[string, string, object | undefined]> = [
      ['PUT', `/api/v1/machines/${M_B}`, { cell: 'Hacked' }],
      ['PUT', `/api/v1/machines/${M_B}`, { active: false }],
      ['GET', `/api/v1/machines/${M_B}/moves`, undefined],
      ['PUT', `/api/v1/machines/${M_B}/criticality`, { criticality: 'C' }],
      ['PUT', `/api/v1/segments/${SEG_B}`, { name: 'Hacked' }],
      ['PUT', `/api/v1/groups/${GROUP_B}`, { hidden: true }],
      ['PUT', `/api/v1/shifts/${SHIFT_B}`, { name: 'Hacked' }],
      ['PUT', `/api/v1/settings/lists/wait_reason/${ITEM_B}`, { active: false }],
      ['PUT', `/api/v1/settings/glossary/${TERM_B}`, { english: 'Hacked' }],
      // Its own plant's row, but through another list's path: a list never reaches another list's rows.
      ['PUT', `/api/v1/settings/lists/work_type/${ITEM_A}`, { active: false }],
      ['PUT', '/api/v1/settings/glossary/not-an-id', { english: 'x' }],
    ];
    for (const [method, url, payload] of attempts) {
      const res = await f.call(method, url, f.tokens.admin!, payload);
      expect(res.statusCode, `${method} ${url}`).toBe(404);
    }
    const b = await f.admin.query('SELECT cell, status, criticality FROM machine WHERE id = $1', [
      M_B,
    ]);
    expect(b.rows[0]).toEqual({ cell: 'Cell 9', status: 'active', criticality: 'B' });
    expect(
      (await f.admin.query('SELECT hidden FROM machine_group WHERE id = $1', [GROUP_B])).rows[0]
        .hidden,
    ).toBe(false);
  });

  it('refuses a segment or group id from the other plant on a create or edit', async () => {
    const cases: Array<[string, string, object]> = [
      ['POST', '/api/v1/machines', { code: 'X-9', segmentId: SEG_B }],
      ['PUT', `/api/v1/machines/${M_FREE}`, { segmentId: SEG_B, groupId: GROUP_B }],
      ['POST', '/api/v1/groups', { segmentId: SEG_B, code: 'X', name: 'X' }],
    ];
    for (const [method, url, payload] of cases) {
      const res = await f.call(method, url, f.tokens.admin!, payload);
      expect(res.statusCode, `${method} ${url}`).toBe(422);
    }
  });

  it("plant B's admin cannot see plant A's machine through the other plant's host", async () => {
    const res = await f.call('PUT', `/api/v1/machines/${M_FREE}`, f.tokens['b-admin']!, {
      cell: 'X',
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('nothing is hard-deleted', () => {
  it('switching off a machine with history keeps the machine and its ticket, and it can be switched on', async () => {
    const off = await f.call('PUT', `/api/v1/machines/${M_USED}`, f.tokens.head!, {
      active: false,
    });
    expect(off.statusCode).toBe(200);
    expect(off.json()).toMatchObject({ status: 'scrapped', active: false });
    const row = await f.admin.query(
      'SELECT m.status, (SELECT count(*)::int FROM ticket t WHERE t.machine_id = m.id) AS tickets FROM machine m WHERE m.id = $1',
      [M_USED],
    );
    expect(row.rows[0]).toEqual({ status: 'scrapped', tickets: 1 });
    const listed = (await f.call('GET', '/api/v1/machines', f.tokens.head!)).json().items;
    expect(listed.find((m: { id: string }) => m.id === M_USED)).toMatchObject({ active: false });
    const config = (await f.call('GET', '/api/v1/config', f.tokens.operator!)).json();
    expect(config.machines.map((m: { id: string }) => m.id)).not.toContain(M_USED);
    const line = await f.admin.query(
      "SELECT action, before, after FROM audit_log WHERE entity_id = $1 AND action = 'machine.switch_off'",
      [M_USED],
    );
    expect(line.rows).toEqual([
      {
        action: 'machine.switch_off',
        before: { status: 'active', active: true },
        after: { status: 'scrapped', active: false },
      },
    ]);
    const on = await f.call('PUT', `/api/v1/machines/${M_USED}`, f.tokens.head!, { active: true });
    expect(on.json()).toMatchObject({ status: 'active', active: true });
  });

  it('has no delete route at all: machines, segments, groups, shifts, lists, glossary', async () => {
    for (const url of [
      `/api/v1/machines/${M_FREE}`,
      `/api/v1/settings/lists/wait_reason/${ITEM_A}`,
      `/api/v1/settings/glossary/${TERM_A}`,
      `/api/v1/segments/${SEG_A}`,
      `/api/v1/groups/${GROUP_A}`,
      `/api/v1/shifts/${SHIFT_A}`,
    ]) {
      const res = await f.call('DELETE', url, f.tokens.admin!);
      expect(res.statusCode, url).toBeGreaterThanOrEqual(400);
    }
    const left = await f.admin.query(
      'SELECT (SELECT count(*) FROM segment WHERE id = $1) + (SELECT count(*) FROM machine_group WHERE id = $2) + (SELECT count(*) FROM shift WHERE id = $3) + (SELECT count(*) FROM machine WHERE id = $4) + (SELECT count(*) FROM list_item WHERE id = $5) + (SELECT count(*) FROM glossary_term WHERE id = $6) AS n',
      [SEG_A, GROUP_A, SHIFT_A, M_FREE, ITEM_A, TERM_A],
    );
    expect(Number(left.rows[0].n)).toBe(6);
  });
});
