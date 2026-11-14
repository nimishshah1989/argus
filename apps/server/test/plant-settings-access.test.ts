import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  GROUP_A,
  GROUP_B,
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
const WRITES: Array<[string, string, object | undefined]> = [
  ['POST', '/api/v1/machines', { code: 'NEW-1' }],
  ['PATCH', `/api/v1/machines/${M_FREE}`, { cell: 'Cell 7' }],
  ['DELETE', `/api/v1/machines/${M_FREE}`, undefined],
  ['POST', '/api/v1/segments', { code: 'NEW', name: 'New' }],
  ['PATCH', `/api/v1/segments/${SEG_A}`, { showOnBoard: false }],
  ['POST', '/api/v1/groups', { segmentId: SEG_A, code: 'NEW', name: 'New' }],
  ['PATCH', `/api/v1/groups/${GROUP_A}`, { hidden: true }],
  ['POST', '/api/v1/shifts', { code: 'NIGHT', name: 'Night', startsAt: '18:29', endsAt: '05:00' }],
  ['PATCH', `/api/v1/shifts/${SHIFT_A}`, { name: 'Day shift' }],
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

  it.each(['head', 'admin'])('%s may list every resource', async (role) => {
    for (const path of ['machines', 'segments', 'groups', 'shifts']) {
      const res = await f.call('GET', `/api/v1/${path}`, f.tokens[role]!);
      expect(res.statusCode, path).toBe(200);
      expect(res.json().length, path).toBeGreaterThan(0);
    }
  });
});

describe('tenancy: plant A cannot see or change plant B', () => {
  it('lists only its own rows', async () => {
    for (const path of ['machines', 'segments', 'groups', 'shifts']) {
      const ids = (await f.call('GET', `/api/v1/${path}`, f.tokens.admin!))
        .json()
        .map((r: { id: string }) => r.id);
      expect(ids, path).not.toContain(M_B);
      expect(ids, path).not.toContain(SEG_B);
      expect(ids, path).not.toContain(GROUP_B);
      expect(ids, path).not.toContain(SHIFT_B);
    }
  });

  it("answers 404 and changes nothing for the other plant's ids", async () => {
    const attempts: Array<[string, string, object | undefined]> = [
      ['PATCH', `/api/v1/machines/${M_B}`, { cell: 'Hacked' }],
      ['DELETE', `/api/v1/machines/${M_B}`, undefined],
      ['GET', `/api/v1/machines/${M_B}/moves`, undefined],
      ['PUT', `/api/v1/machines/${M_B}/criticality`, { criticality: 'C' }],
      ['PATCH', `/api/v1/segments/${SEG_B}`, { name: 'Hacked' }],
      ['PATCH', `/api/v1/groups/${GROUP_B}`, { hidden: true }],
      ['PATCH', `/api/v1/shifts/${SHIFT_B}`, { name: 'Hacked' }],
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
      ['PATCH', `/api/v1/machines/${M_FREE}`, { segmentId: SEG_B, groupId: GROUP_B }],
      ['POST', '/api/v1/groups', { segmentId: SEG_B, code: 'X', name: 'X' }],
    ];
    for (const [method, url, payload] of cases) {
      const res = await f.call(method, url, f.tokens.admin!, payload);
      expect(res.statusCode, `${method} ${url}`).toBe(422);
    }
  });

  it("plant B's admin cannot see plant A's machine through the other plant's host", async () => {
    const res = await f.call('PATCH', `/api/v1/machines/${M_FREE}`, f.tokens['b-admin']!, {
      cell: 'X',
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('nothing is hard-deleted', () => {
  it('switching off a machine with history keeps the machine and its ticket, and it can be switched on', async () => {
    const off = await f.call('DELETE', `/api/v1/machines/${M_USED}`, f.tokens.head!);
    expect(off.statusCode).toBe(200);
    expect(off.json().status).toBe('scrapped');
    const row = await f.admin.query(
      'SELECT m.status, (SELECT count(*)::int FROM ticket t WHERE t.machine_id = m.id) AS tickets FROM machine m WHERE m.id = $1',
      [M_USED],
    );
    expect(row.rows[0]).toEqual({ status: 'scrapped', tickets: 1 });
    const listed = (await f.call('GET', '/api/v1/machines', f.tokens.head!)).json();
    expect(listed.find((m: { id: string }) => m.id === M_USED).status).toBe('scrapped');
    const config = (await f.call('GET', '/api/v1/config', f.tokens.operator!)).json();
    expect(config.machines.map((m: { id: string }) => m.id)).not.toContain(M_USED);
    const line = await f.admin.query(
      "SELECT action, before, after FROM audit_log WHERE entity_id = $1 AND action = 'machine.switch_off'",
      [M_USED],
    );
    expect(line.rows).toEqual([
      { action: 'machine.switch_off', before: { status: 'active' }, after: { status: 'scrapped' } },
    ]);
    const on = await f.call('PATCH', `/api/v1/machines/${M_USED}`, f.tokens.head!, {
      status: 'active',
    });
    expect(on.json().status).toBe('active');
  });

  it('has no delete for segments, groups or shifts', async () => {
    for (const url of [
      `/api/v1/segments/${SEG_A}`,
      `/api/v1/groups/${GROUP_A}`,
      `/api/v1/shifts/${SHIFT_A}`,
    ]) {
      const res = await f.call('DELETE', url, f.tokens.admin!);
      expect(res.statusCode, url).toBeGreaterThanOrEqual(400);
    }
    const left = await f.admin.query(
      'SELECT (SELECT count(*) FROM segment WHERE id = $1) + (SELECT count(*) FROM machine_group WHERE id = $2) + (SELECT count(*) FROM shift WHERE id = $3) AS n',
      [SEG_A, GROUP_A, SHIFT_A],
    );
    expect(Number(left.rows[0].n)).toBe(3);
  });
});
