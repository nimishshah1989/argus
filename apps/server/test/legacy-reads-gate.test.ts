import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROLES, startFixture, type Fixture } from './plant-settings-fixture.js';

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
}, 180_000);
afterAll(async () => f.stop());

// The older settings reads (before the generated screens): the same data the settings screens now read
// under head and admin, so they follow the same permission cell (DOMAIN §3).
const LEGACY_READS = [
  '/api/v1/settings',
  '/api/v1/lists/wait_reason',
  '/api/v1/translations/missing',
];

describe('the legacy settings reads follow the settings permission', () => {
  it.each(ROLES.filter((r) => r !== 'head' && r !== 'admin'))(
    '%s is refused every one of them, and still reads /config for the floor and the desk',
    async (role) => {
      for (const url of LEGACY_READS) {
        expect((await f.call('GET', url, f.tokens[role]!)).statusCode, `${role} ${url}`).toBe(403);
      }
      expect((await f.call('GET', '/api/v1/config', f.tokens[role]!)).statusCode).toBe(200);
    },
  );

  it.each(['head', 'admin'])('%s may read all three', async (role) => {
    for (const url of LEGACY_READS) {
      expect((await f.call('GET', url, f.tokens[role]!)).statusCode, `${role} ${url}`).toBe(200);
    }
  });

  it('answers 401 without a login', async () => {
    for (const url of LEGACY_READS) {
      const res = await f.app.inject({
        method: 'GET',
        url,
        headers: { host: 'plant-a.localhost' },
      });
      expect(res.statusCode, url).toBe(401);
    }
  });

  it("a plant's reads show that plant only", async () => {
    const own = (await f.call('GET', '/api/v1/lists/wait_reason', f.tokens.admin!)).json();
    const other = (await f.call('GET', '/api/v1/lists/wait_reason', f.tokens['b-admin']!)).json();
    expect(own.map((r: { id: string }) => r.id)).not.toEqual(
      other.map((r: { id: string }) => r.id),
    );
    expect(own).toHaveLength(1);
    expect(other).toHaveLength(1);
  });
});
