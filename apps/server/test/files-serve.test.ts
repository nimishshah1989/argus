import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
const EMPTY_ID = '10000000-0000-0000-0000-00000000010b';
const TAMPERED_ID = '10000000-0000-0000-0000-00000000010c';

let f: Fixture;

async function addFile(
  id: string,
  tenant: string,
  row: { kind: string; mime: string; content?: Buffer | null; sha?: string },
) {
  const content = row.content === undefined ? PNG : row.content;
  await f.admin.query(
    'INSERT INTO file (id, tenant_id, kind, s3_key, mime, bytes, sha256, content) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [
      id,
      tenant,
      row.kind,
      `db:test/${id}`,
      row.mime,
      content?.length ?? 0,
      row.sha ?? sha256(content ?? Buffer.alloc(0)),
      content,
    ],
  );
}

beforeAll(async () => {
  f = await startFixture();
  await addFile(LOGO_A, A, { kind: 'logo', mime: 'image/png' });
  await addFile(LOGO_B, B, { kind: 'logo', mime: 'image/png' });
  // A stored PDF carries no content (only a logo may), so it is refused on kind long before bytes matter.
  await addFile(PDF_ID, A, { kind: 'pdf', mime: 'application/pdf', content: null });
  await addFile(HTML_ID, A, {
    kind: 'logo',
    mime: 'text/html',
    content: Buffer.from('<script>alert(1)</script>'),
  });
  await addFile(EMPTY_ID, A, { kind: 'logo', mime: 'image/png', content: null });
  await addFile(TAMPERED_ID, A, {
    kind: 'logo',
    mime: 'image/png',
    content: Buffer.from('not what was recorded'),
    sha: sha256(PNG),
  });
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

  it('answers 404 when a row has no content, and 500 when the content does not match its record', async () => {
    expect((await get(EMPTY_ID, f.tokens.admin!)).statusCode).toBe(404);
    const tampered = await get(TAMPERED_ID, f.tokens.admin!);
    expect(tampered.statusCode).toBe(500);
    expect(tampered.json().error.code).toBe('internal');
  });
});
