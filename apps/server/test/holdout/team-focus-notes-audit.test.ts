import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { A, startFixture, type Fixture } from '../plant-settings-fixture.js';

/** TF-1 reviewer gap, pinned with TF-3 (ADR 0018 §8): each Team Focus write's audit line names the login that wrote it. */

const URL = '/api/v1/analytics/team-focus/notes';
let f: Fixture;

beforeAll(async () => {
  f = await startFixture();
}, 180_000);

afterAll(async () => f.stop());

describe('Team Focus notes: the audit line', () => {
  it('records the writing login on every save, for each role that may write', async () => {
    for (const role of ['supervisor', 'head', 'admin']) {
      const action = `audit|${role}`;
      const res = await f.call('PUT', URL, f.tokens[role]!, {
        period: '2026-12',
        action,
        status: 'prog',
      });
      expect(res.statusCode, role).toBe(200);
      const login = await f.admin.query(
        'SELECT id FROM login WHERE tenant_id = $1 AND username = $2',
        [A, `plant-a-${role}`],
      );
      const row = await f.admin.query('SELECT id FROM setting WHERE tenant_id = $1 AND key = $2', [
        A,
        `focus:2026-12|${action}`,
      ]);
      const lines = await f.admin.query(
        "SELECT login_id FROM audit_log WHERE entity = 'setting' AND action = 'focus.save' AND entity_id = $1",
        [row.rows[0].id],
      );
      expect(login.rows, role).toHaveLength(1);
      expect(lines.rows, role).toEqual([{ login_id: login.rows[0].id }]);
    }
  });
});
