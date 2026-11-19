import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { M_B, M_FREE, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

/**
 * Ticket 77a: the plant switches a spare-capacity machine to "not counted in production data". The switch is one audit
 * line, the engine reads it, and the figures say how many machines are left out.
 */

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
  // A machine that already carries its own metadata: switching it out and in must leave that alone.
  await f.admin.query(`UPDATE machine SET metadata = '{"efficiency": 60}' WHERE id = $1`, [M_FREE]);
}, 180_000);
afterAll(async () => f.stop());

const AS_OF = '2026-11-11';
const path = (id: string) => `/api/v1/machines/${id}/production-data`;
const lines = async (id: string) =>
  (
    await f.admin.query(
      `SELECT action, before, after, l.username FROM audit_log a LEFT JOIN login l ON l.id = a.login_id
        WHERE a.entity = 'machine' AND a.entity_id = $1 AND a.action = 'machine.production_data'
        ORDER BY a.at, a.id`,
      [id],
    )
  ).rows as Array<{ action: string; before: unknown; after: unknown; username: string }>;
const metadata = async (id: string) =>
  (await f.admin.query('SELECT metadata FROM machine WHERE id = $1', [id])).rows[0].metadata;
const figures = async () => {
  const res = await f.call('GET', `/api/v1/analytics/figures?asOf=${AS_OF}`, f.tokens.head!);
  expect(res.statusCode).toBe(200);
  return res.json() as {
    excludedMachines: number;
    figures: Array<{ key: string; value: unknown; drill: { ids: string[] } }>;
  };
};
type Reply = Awaited<ReturnType<typeof figures>>;
const figureOf = (reply: Reply, key: string) => reply.figures.find((entry) => entry.key === key)!;
/** The machines fleet availability divides by: the production fleet. */
const production = (reply: Reply) =>
  figureOf(reply, 'dashboard.fleet-availability').drill.ids.length;
/** The machine count of the plant's CNC list, which keeps a left-out machine. */
const cncCount = (reply: Reply) => figureOf(reply, 'dashboard.cnc-machines').value;

describe('switching a machine out of production data', () => {
  it('writes one audit line per change, none for a repeat, and keeps the rest of the machine as it was', async () => {
    const off = await f.call('PUT', path(M_FREE), f.tokens.head!, { excludedFromProduction: true });
    expect(off.statusCode).toBe(200);
    expect(off.json()).toEqual({ id: M_FREE, code: 'VC-01', excludedFromProduction: true });
    expect(await lines(M_FREE)).toMatchObject([
      {
        username: 'plant-a-head',
        before: { excludedFromProduction: false },
        after: { excludedFromProduction: true },
      },
    ]);
    expect(await metadata(M_FREE)).toEqual({ efficiency: 60, excludedFromProduction: true });

    const again = await f.call('PUT', path(M_FREE), f.tokens.head!, {
      excludedFromProduction: true,
    });
    expect(again.statusCode).toBe(200);
    expect(await lines(M_FREE)).toHaveLength(1);

    const back = await f.call('PUT', path(M_FREE), f.tokens.admin!, {
      excludedFromProduction: false,
    });
    expect(back.json().excludedFromProduction).toBe(false);
    expect((await lines(M_FREE)).map((line) => [line.username, line.after])).toEqual([
      ['plant-a-head', { excludedFromProduction: true }],
      ['plant-a-admin', { excludedFromProduction: false }],
    ]);
    expect(await metadata(M_FREE)).toEqual({ efficiency: 60 });
  });

  it('is refused for the floor, a supervisor, the plant head and the board, and for another plant', async () => {
    for (const role of ['operator', 'technician', 'supervisor', 'plant_head', 'board']) {
      const res = await f.call('PUT', path(M_USED), f.tokens[role]!, {
        excludedFromProduction: true,
      });
      expect(res.statusCode, role).toBe(403);
    }
    const foreign = await f.call('PUT', path(M_B), f.tokens.admin!, {
      excludedFromProduction: true,
    });
    expect(foreign.statusCode).toBe(404);
    const stray = await f.call(
      'PUT',
      path('10000000-0000-0000-0000-00000000ffff'),
      f.tokens.head!,
      {
        excludedFromProduction: true,
      },
    );
    expect(stray.statusCode).toBe(404);
    expect(await lines(M_USED)).toHaveLength(0);
    expect(await metadata(M_B)).toEqual({});
    expect(await lines(M_B)).toHaveLength(0);
  });

  it('names the field when the body is not a yes or a no', async () => {
    for (const body of [
      {},
      { excludedFromProduction: 'yes' },
      { excludedFromProduction: true, x: 1 },
    ]) {
      const res = await f.call('PUT', path(M_USED), f.tokens.head!, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(422);
    }
    expect(await lines(M_USED)).toHaveLength(0);
  });

  it('is read by the figures, which say how many machines are left out; the machine counts stay whole', async () => {
    const before = await figures();
    expect(before.excludedMachines).toBe(0);
    expect(production(before)).toBe(2);
    await f.call('PUT', path(M_USED), f.tokens.head!, { excludedFromProduction: true });
    const during = await figures();
    expect(during.excludedMachines).toBe(1);
    expect(production(during)).toBe(1);
    expect(cncCount(during)).toBe(cncCount(before));
    await f.call('PUT', path(M_USED), f.tokens.head!, { excludedFromProduction: false });
    const after = await figures();
    expect([after.excludedMachines, production(after)]).toEqual([0, 2]);
    expect(await lines(M_USED)).toHaveLength(2);
  });
});
