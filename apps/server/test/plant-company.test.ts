import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { A, ROLES, startFixture, type Fixture } from './plant-settings-fixture.js';

// Real image headers followed by filler: enough for the type check, not pictures.
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('uptimo-logo')]);
const JPEG = Buffer.concat([Buffer.from('ffd8ffe0', 'hex'), Buffer.from('uptimo-logo')]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([4, 0, 0, 0]),
  Buffer.from('WEBPuptimo'),
]);

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
}, 180_000);
afterAll(async () => f.stop());

const head = () => f.tokens.head!;
const put = (key: string, value: unknown, token = head()) =>
  f.call('PUT', `/api/v1/settings/${key}`, token, { value });
const settings = async (token = head()) =>
  Object.fromEntries(
    (await f.call('GET', '/api/v1/settings', token))
      .json()
      .map((r: { key: string; value: unknown }) => [r.key, r.value]),
  );
const brand = (slug: string) =>
  f.app.inject({ method: 'GET', url: '/api/v1/brand', headers: { host: `${slug}.localhost` } });

describe('company name, language and time zone', () => {
  it('a head changes each, the floor sees the change, and each is audited with before and after', async () => {
    expect((await put('company.name', 'Plant A Engineering')).statusCode).toBe(200);
    expect((await put('company.language', 'gu')).statusCode).toBe(200);
    expect((await put('company.timeZone', 'Asia/Dubai', f.tokens.admin!)).statusCode).toBe(200);
    expect(await settings()).toMatchObject({
      'company.name': 'Plant A Engineering',
      'company.language': 'gu',
      'company.timeZone': 'Asia/Dubai',
    });
    const config = (await f.call('GET', '/api/v1/config', f.tokens.operator!)).json();
    expect(config).toMatchObject({ language: 'gu', timeZone: 'Asia/Dubai' });
    expect((await brand('plant-a')).json().company).toBe('Plant A Engineering');
    const lines = await f.admin.query(
      "SELECT before, after, l.username FROM audit_log a JOIN login l ON l.id = a.login_id WHERE a.after->>'key' LIKE 'company.%' ORDER BY a.at",
    );
    expect(lines.rows).toEqual([
      {
        before: { key: 'company.name', value: 'plant-a' },
        after: { key: 'company.name', value: 'Plant A Engineering' },
        username: 'plant-a-head',
      },
      {
        before: { key: 'company.language', value: 'en' },
        after: { key: 'company.language', value: 'gu' },
        username: 'plant-a-head',
      },
      {
        before: { key: 'company.timeZone', value: 'Asia/Kolkata' },
        after: { key: 'company.timeZone', value: 'Asia/Dubai' },
        username: 'plant-a-admin',
      },
    ]);
  });

  it('an unchanged value writes no audit line; a bad value is 422 with the field and changes nothing', async () => {
    const count = async () =>
      Number((await f.admin.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n);
    const before = await count();
    expect((await put('company.language', 'gu')).statusCode).toBe(200);
    expect(await count()).toBe(before);
    for (const [key, value] of [
      ['company.language', 'fr'],
      ['company.timeZone', 'Mars/Olympus'],
      ['company.timeZone', 'not a zone'],
      ['company.name', '   '],
      ['company.name', 42],
      ['company.name', 'Plant\u0000A'],
      ['company.name', 'Plant\nA'],
    ] as const) {
      const res = await put(key, value);
      expect(res.statusCode, `${key} ${value}`).toBe(422);
      expect(res.json().error.field).toBe('value');
    }
    expect(await settings()).toMatchObject({
      'company.language': 'gu',
      'company.timeZone': 'Asia/Dubai',
    });
  });

  it.each(ROLES.filter((r) => r !== 'head' && r !== 'admin'))(
    '%s is refused every company setting',
    async (role) => {
      for (const [key, value] of [
        ['company.name', 'X'],
        ['company.language', 'hi'],
        ['company.timeZone', 'UTC'],
      ] as const) {
        expect((await put(key, value, f.tokens[role]!)).statusCode, `${role} ${key}`).toBe(403);
      }
      expect((await settings())['company.name']).toBe('Plant A Engineering');
    },
  );

  it("plant B's admin changes plant B only", async () => {
    expect((await put('company.name', 'Plant B Works', f.tokens['b-admin']!)).statusCode).toBe(200);
    expect((await settings())['company.name']).toBe('Plant A Engineering');
    expect((await settings(f.tokens['b-admin']!))['company.name']).toBe('Plant B Works');
    expect((await brand('plant-b')).json().company).toBe('Plant B Works');
  });
});

describe('the company logo', () => {
  const logo = (token: string | null, type: string, bytes: Buffer, host?: string) =>
    f.raw('/api/v1/company/logo', token, { type, bytes, host });

  it('a head uploads a PNG: the sign-in page shows it, every signed-in login can fetch it, and it is audited', async () => {
    expect((await brand('plant-a')).json().logo).toBeNull();
    const res = await logo(head(), 'image/png', PNG);
    expect(res.statusCode).toBe(200);
    const path = res.json().logo as string;
    expect(path).toMatch(/^\/api\/v1\/files\/[0-9a-f-]{36}$/);
    const fileId = path.split('/').pop();
    expect((await brand('plant-a')).json()).toMatchObject({
      company: 'Plant A Engineering',
      logo: `/api/v1/brand/logo?v=${fileId}`,
    });
    const pub = await f.app.inject({
      method: 'GET',
      url: '/api/v1/brand/logo',
      headers: { host: 'plant-a.localhost' },
    });
    expect(pub.statusCode).toBe(200);
    expect(pub.headers['content-type']).toBe('image/png');
    expect(pub.headers['x-content-type-options']).toBe('nosniff');
    expect(pub.rawPayload.equals(PNG)).toBe(true);
    for (const role of ROLES) {
      const own = await f.call('GET', path, f.tokens[role]!);
      expect(own.statusCode, role).toBe(200);
      expect(own.rawPayload.equals(PNG), role).toBe(true);
    }
    const line = await f.admin.query("SELECT after FROM audit_log WHERE action = 'company.logo'");
    expect(line.rows).toEqual([
      { after: expect.objectContaining({ mime: 'image/png', bytes: PNG.length }) },
    ]);
    const first = await f.admin.query("SELECT before FROM audit_log WHERE action = 'company.logo'");
    expect(first.rows[0].before).toEqual({ fileId: null });
  });

  it("another company never gets this company's logo, publicly or signed in", async () => {
    const other = await f.app.inject({
      method: 'GET',
      url: '/api/v1/brand/logo',
      headers: { host: 'plant-b.localhost' },
    });
    expect(other.statusCode).toBe(404);
    expect((await brand('plant-b')).json().logo).toBeNull();
    const mine = (
      await f.admin.query('SELECT id FROM file WHERE tenant_id = $1 AND kind = $2', [A, 'logo'])
    ).rows[0].id;
    expect((await f.call('GET', `/api/v1/files/${mine}`, f.tokens['b-admin']!)).statusCode).toBe(
      404,
    );
    const unknown = await f.app.inject({
      method: 'GET',
      url: '/api/v1/brand/logo',
      headers: { host: 'nobody.localhost' },
    });
    expect(unknown.statusCode).toBe(404);
  });

  it('JPEG and WebP are accepted; a new upload replaces the logo and the old file is kept', async () => {
    const png = (
      await f.admin.query("SELECT id FROM file WHERE tenant_id = $1 AND kind = 'logo'", [A])
    ).rows[0].id;
    expect((await logo(head(), 'image/jpeg', JPEG)).statusCode).toBe(200);
    const replaced = await f.admin.query(
      "SELECT before FROM audit_log WHERE action = 'company.logo' ORDER BY at DESC LIMIT 1",
    );
    expect(replaced.rows[0].before).toEqual({ fileId: png });
    expect((await logo(f.tokens.admin!, 'image/webp', WEBP)).statusCode).toBe(200);
    const pub = await f.app.inject({
      method: 'GET',
      url: '/api/v1/brand/logo',
      headers: { host: 'plant-a.localhost' },
    });
    expect(pub.headers['content-type']).toBe('image/webp');
    expect(
      Number(
        (
          await f.admin.query(
            "SELECT count(*)::int AS n FROM file WHERE tenant_id = $1 AND kind = 'logo'",
            [A],
          )
        ).rows[0].n,
      ),
    ).toBe(3);
  });

  it('refuses what is not a PNG, JPEG or WebP: wrong bytes, a lying type, SVG, plain text, nothing at all', async () => {
    const cases: Array<[string, Buffer, number]> = [
      ['image/png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 422],
      ['image/png', JPEG, 422],
      ['image/jpeg', PNG, 422],
      ['image/webp', Buffer.from('RIFF....WAVEfmt '), 422],
      ['image/png', Buffer.alloc(0), 422],
      ['image/svg+xml', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 415],
      ['text/html', Buffer.from('<script>alert(1)</script>'), 415],
      ['application/octet-stream', PNG, 415],
    ];
    for (const [type, bytes, status] of cases) {
      const res = await logo(head(), type, bytes);
      expect(res.statusCode, `${type} ${bytes.length}b`).toBe(status);
    }
  });

  it('refuses a logo over 256 KB and leaves the current one', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(256 * 1024)]);
    const res = await logo(head(), 'image/png', big);
    expect(res.statusCode).toBe(413);
    const pub = await f.app.inject({
      method: 'GET',
      url: '/api/v1/brand/logo',
      headers: { host: 'plant-a.localhost' },
    });
    expect(pub.headers['content-type']).toBe('image/webp');
  });

  it.each(ROLES.filter((r) => r !== 'head' && r !== 'admin'))(
    '%s cannot upload a logo',
    async (role) => {
      expect((await logo(f.tokens[role]!, 'image/png', PNG)).statusCode).toBe(403);
    },
  );

  it('answers 401 without a login, and plant B uploads its own without touching plant A', async () => {
    expect((await logo(null, 'image/png', PNG)).statusCode).toBe(401);
    const before = (
      await f.app.inject({
        method: 'GET',
        url: '/api/v1/brand/logo',
        headers: { host: 'plant-a.localhost' },
      })
    ).rawPayload;
    expect((await logo(f.tokens['b-admin']!, 'image/png', PNG, 'plant-b')).statusCode).toBe(200);
    expect((await brand('plant-b')).json().logo).toMatch(
      /^\/api\/v1\/brand\/logo\?v=[0-9a-f-]{36}$/,
    );
    const after = (
      await f.app.inject({
        method: 'GET',
        url: '/api/v1/brand/logo',
        headers: { host: 'plant-a.localhost' },
      })
    ).rawPayload;
    expect(after.equals(before)).toBe(true);
  });
});
