import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { A } from './people-harness.js';
import { startSupportApp, type SupportApp } from './support-harness.js';

/**
 * MILESTONES 78c: failed jobs are for the admin and the head on a personal login. A head on a SHARED phone and our
 * own support staff under a grant are refused through the API, on the list and on Retry (the rule is also
 * unit-tested in the domain package).
 */
const LIST = '/api/v1/jobs/failed';
const JOB = '10000000-0000-4000-8000-0000000000aa';

let t: SupportApp;

beforeAll(async () => {
  t = await startSupportApp();
}, 120_000);

afterAll(async () => {
  await t?.stop();
});

describe('failed jobs: who is refused through the API', () => {
  it('refuses a head on a shared login, on the list and on Retry, and lets the same role in on a personal one', async () => {
    await t.db.admin.query(
      `INSERT INTO login (tenant_id, username, password_hash, role, shared, cell)
       SELECT tenant_id, 'shared-head', password_hash, 'head', true, 'Cell-2' FROM login WHERE username = 'head' AND tenant_id = $1`,
      [A],
    );
    const shared = await t.signIn('shared-head');
    expect((await t.call('GET', LIST, shared)).statusCode).toBe(403);
    expect((await t.call('POST', `${LIST}/${JOB}/retry`, shared, {})).statusCode).toBe(403);
    const personal = await t.signIn('head');
    expect((await t.call('GET', LIST, personal)).statusCode).toBe(200);
  });

  it('refuses our own support staff under an approved grant, on the list and on Retry', async () => {
    const admin = await t.signIn('admin');
    const grant = await t.approve(admin);
    const list = await t.support(t.keys.one, grant.id, { method: 'GET', url: LIST });
    expect(list.statusCode, list.body).toBe(403);
    const retry = await t.support(t.keys.one, grant.id, {
      method: 'POST',
      url: `${LIST}/${JOB}/retry`,
      payload: {},
    });
    expect(retry.statusCode, retry.body).toBe(403);
  });
});
