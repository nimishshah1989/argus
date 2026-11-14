import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLocalFileStore } from '../src/modules/files/index.js';
import { sha256 } from '../src/modules/files/store.js';
import {
  A,
  B,
  LOGO_A,
  LOGO_B,
  ROLES,
  startFixture,
  type Fixture,
} from './plant-settings-fixture.js';

// A real PNG header (8 magic bytes) followed by filler: enough for a content-type check, not a picture.
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('uptimo-logo')]);
const PDF_ID = '10000000-0000-0000-0000-000000000109';
const HTML_ID = '10000000-0000-0000-0000-00000000010a';
const GONE_ID = '10000000-0000-0000-0000-00000000010b';
const TAMPERED_ID = '10000000-0000-0000-0000-00000000010c';
const ESCAPE_ID = '10000000-0000-0000-0000-00000000010d';

let f: Fixture;
let dir: string;

async function addFile(
  id: string,
  tenant: string,
  row: { kind: string; key: string; mime: string; bytes?: Buffer; sha?: string },
) {
  const bytes = row.bytes ?? PNG;
  await f.admin.query(
    'INSERT INTO file (id, tenant_id, kind, s3_key, mime, bytes, sha256) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, tenant, row.kind, row.key, row.mime, bytes.length, row.sha ?? sha256(bytes)],
  );
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'uptimo-files-'));
  f = await startFixture(dir);
  const store = createLocalFileStore(dir);
  await store.put('a/logo.png', PNG);
  await store.put('b/logo.png', PNG);
  await store.put('a/doc.pdf', Buffer.from('%PDF-1.4'));
  await store.put('a/page.html', Buffer.from('<script>alert(1)</script>'));
  await store.put('a/tampered.png', Buffer.from('not what was stored'));
  writeFileSync(join(dir, '..', 'outside-secret.txt'), 'secret');
  await addFile(LOGO_A, A, { kind: 'logo', key: 'a/logo.png', mime: 'image/png' });
  await addFile(LOGO_B, B, { kind: 'logo', key: 'b/logo.png', mime: 'image/png' });
  await addFile(PDF_ID, A, {
    kind: 'pdf',
    key: 'a/doc.pdf',
    mime: 'application/pdf',
    bytes: Buffer.from('%PDF-1.4'),
  });
  await addFile(HTML_ID, A, {
    kind: 'logo',
    key: 'a/page.html',
    mime: 'text/html',
    bytes: Buffer.from('<script>alert(1)</script>'),
  });
  await addFile(GONE_ID, A, { kind: 'logo', key: 'a/missing.png', mime: 'image/png' });
  await addFile(TAMPERED_ID, A, {
    kind: 'logo',
    key: 'a/tampered.png',
    mime: 'image/png',
    sha: sha256(PNG),
  });
  await addFile(ESCAPE_ID, A, { kind: 'logo', key: '../outside-secret.txt', mime: 'image/png' });
}, 180_000);
afterAll(async () => f.stop());

const get = (id: string, token: string) => f.call('GET', `/api/v1/files/${id}`, token);

describe('GET /files/:id', () => {
  it.each(ROLES)(
    'serves a plant logo to a signed-in %s of that plant, as an image that cannot be sniffed',
    async (role) => {
      const res = await get(LOGO_A, f.tokens[role]!);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.rawPayload.equals(PNG)).toBe(true);
    },
  );

  it('answers 401 without a login', async () => {
    const res = await f.app.inject({
      method: 'GET',
      url: `/api/v1/files/${LOGO_A}`,
      headers: { host: 'plant-a.localhost' },
    });
    expect(res.statusCode).toBe(401);
  });

  it("answers 404 for another plant's file, in both directions", async () => {
    expect((await get(LOGO_B, f.tokens.admin!)).statusCode).toBe(404);
    expect((await get(LOGO_A, f.tokens['b-admin']!)).statusCode).toBe(404);
    expect((await get(LOGO_B, f.tokens['b-admin']!)).statusCode).toBe(200);
  });

  it('serves nothing but logos: a stored PDF, a non-image and a bad id are all 404', async () => {
    for (const id of [PDF_ID, HTML_ID, 'not-an-id', '10000000-0000-0000-0000-00000000ffff']) {
      expect((await get(id, f.tokens.admin!)).statusCode, id).toBe(404);
    }
  });

  it('answers 404 when the bytes are gone, 500 when they do not match their record, and never reads outside the folder', async () => {
    expect((await get(GONE_ID, f.tokens.admin!)).statusCode).toBe(404);
    const tampered = await get(TAMPERED_ID, f.tokens.admin!);
    expect(tampered.statusCode).toBe(500);
    expect(tampered.json().error.code).toBe('internal');
    const escape = await get(ESCAPE_ID, f.tokens.admin!);
    expect(escape.statusCode).toBe(404);
    expect(escape.rawPayload.toString()).not.toContain('secret');
  });
});
