import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { redactionTerms } from '../src/modules/identity/index.js';
import { startTestDb, type TestDb } from './harness.js';

const A = '61000000-0000-4000-8000-00000000000a';
const B = '61000000-0000-4000-8000-00000000000b';

describe('identity redactionTerms', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await startTestDb();
    await db.admin.query(
      `INSERT INTO tenant (id, slug, name) VALUES ($1, 'terms-a', 'Test Plant A'), ($2, 'terms-b', 'Test Plant B')`,
      [A, B],
    );
    await db.admin.query(
      `INSERT INTO person (tenant_id, name, short_name, phone, active) VALUES
         ($1, 'Ravi Fake', 'Ravi', '+919000000101', true),
         ($1, 'Mina Fake', NULL, '+919000000102', false),
         ($2, 'Bina Fake', 'Bina', '+919000000201', true)`,
      [A, B],
    );
    await db.admin.query(
      `INSERT INTO login (tenant_id, username, password_hash, role, disabled_at) VALUES
         ($1, 'ravi.f', 'hash', 'technician', NULL),
         ($1, 'old.user', 'hash', 'technician', now()),
         ($2, 'bina.f', 'hash', 'technician', NULL)`,
      [A, B],
    );
  });

  afterAll(async () => {
    await db.stop();
  });

  it('returns every name, short name, phone and username of the tenant, former people included, and the plant name', async () => {
    const terms = await withTenant(db.app, A, (tx) => redactionTerms(tx, A));
    expect([...terms.names].sort()).toEqual(['Mina Fake', 'Ravi Fake']);
    expect(terms.shortNames).toEqual(['Ravi']);
    expect([...terms.phones].sort()).toEqual(['+919000000101', '+919000000102']);
    expect([...terms.usernames].sort()).toEqual(['old.user', 'ravi.f']);
    expect(terms.tenantName).toBe('Test Plant A');
  });

  it('returns nothing of another tenant', async () => {
    const terms = await withTenant(db.app, A, (tx) => redactionTerms(tx, A));
    const all = [
      ...terms.names,
      ...terms.shortNames,
      ...terms.phones,
      ...terms.usernames,
      terms.tenantName,
    ].join('|');
    for (const other of ['Bina', '+919000000201', 'bina.f', 'Test Plant B']) {
      expect(all).not.toContain(other);
    }
    expect(terms.tenantName).toBe('Test Plant A');
  });
});
