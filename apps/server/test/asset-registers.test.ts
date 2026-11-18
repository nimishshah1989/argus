import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assetRegisterReplySchema } from '@uptimo/shared/plant-settings';
import { A, B, M_B, M_FREE, startFixture, type Fixture } from './plant-settings-fixture.js';

/**
 * The generated `/settings/registers` resource (ticket 51a, R6/R7): create, edit, remove with its audited reason,
 * the four replies and the tenant/permission rails. The seed's own three rows are proved by `cosmos-seed.test.ts`.
 */

let f: Fixture;
let owner = '';
let inactiveOwner = '';
let foreign = '';
let created = '';

const seedDraft = {
  kind: 'warranty',
  machineId: M_FREE,
  vendor: 'V-1',
  reference: 'R-1',
  startsOn: '2026-01-31',
  endsOn: '2028-01-30',
  dueOn: '2027-02-01',
  leadDays: '30',
  notes: 'Mitsubishi EWC',
};

beforeAll(async () => {
  f = await startFixture();
  owner = (
    await f.admin.query(
      'SELECT id FROM person WHERE tenant_id = $1 AND active ORDER BY name LIMIT 1',
      [A],
    )
  ).rows[0].id as string;
  inactiveOwner = (
    await f.admin.query(
      `INSERT INTO person (tenant_id, name, team, active) VALUES ($1, 'Retired owner', 'maintenance', false)
       RETURNING id`,
      [A],
    )
  ).rows[0].id as string;
  foreign = (
    await f.admin.query(
      "INSERT INTO asset_register (tenant_id, kind, notes) VALUES ($1, 'legal', 'their test') RETURNING id",
      [B],
    )
  ).rows[0].id as string;
}, 180_000);
afterAll(() => f.stop());

const head = () => f.tokens.head!;
const base = '/api/v1/settings/registers';

async function audits(id: string) {
  return (
    await f.admin.query(
      `SELECT action, before, after FROM audit_log
        WHERE entity = 'asset_register' AND entity_id = $1 ORDER BY at, id`,
      [id],
    )
  ).rows as Array<{
    action: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  }>;
}

describe('the asset register settings resource', () => {
  it('lists only this plant’s rows; the other plant’s row is invisible', async () => {
    const res = await f.call('GET', base, head());
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], nextCursor: null });
    expect(res.json().items.some((row: { id: string }) => row.id === foreign)).toBe(false);
  });

  it('creates a row from a form’s text fields and audits the create', async () => {
    const res = await f.call('POST', base, head(), { ...seedDraft, ownerPersonId: owner });
    expect(res.statusCode, res.body).toBe(201);
    const body = res.json();
    expect(assetRegisterReplySchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      kind: 'warranty',
      machineId: M_FREE,
      vendor: 'V-1',
      reference: 'R-1',
      startsOn: '2026-01-31',
      endsOn: '2028-01-30',
      dueOn: '2027-02-01',
      leadDays: 30,
      ownerPersonId: owner,
      notes: 'Mitsubishi EWC',
      active: true,
    });
    created = body.id;
    const lines = await audits(created);
    expect(lines.map((line) => line.action)).toEqual(['register.create']);
    expect(lines[0]!.before).toBeNull();
    expect(lines[0]!.after).toMatchObject({ kind: 'warranty', machineId: M_FREE, leadDays: 30 });
  });

  it('defaults the lead to the platform’s 15 days', async () => {
    const res = await f.call('POST', base, head(), {
      kind: 'legal',
      machineId: M_FREE,
      notes: 'Test Of Pressure Vessel · Form No 11',
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().leadDays).toBe(15);
  });

  it('shows the row after reload and edits only the one key the edit touched', async () => {
    const listed = (await f.call('GET', base, head()))
      .json()
      .items.find((row: { id: string }) => row.id === created);
    expect(listed).toMatchObject({ id: created, active: true, dueOn: '2027-02-01' });

    const res = await f.call('PUT', `${base}/${created}`, head(), { dueOn: '2027-03-01' });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().dueOn).toBe('2027-03-01');
    const lines = await audits(created);
    expect(lines.map((line) => line.action)).toEqual(['register.create', 'register.update']);
    expect(lines[1]!.before).toEqual({ dueOn: '2027-02-01' });
    expect(lines[1]!.after).toEqual({ dueOn: '2027-03-01' });
  });

  it('refuses a backwards end, an unknown or foreign machine, an inactive owner and a bad lead', async () => {
    const backwards = await f.call('POST', base, head(), {
      kind: 'amc',
      machineId: M_FREE,
      startsOn: '2026-06-01',
      endsOn: '2026-05-01',
    });
    expect(backwards.statusCode).toBe(422);
    expect(backwards.json().error.field).toBe('endsOn');

    const unknown = await f.call('POST', base, head(), {
      kind: 'amc',
      machineId: '00000000-0000-0000-0000-0000000000ff',
    });
    expect(unknown.statusCode).toBe(422);
    expect(unknown.json().error.field).toBe('machineId');

    const otherPlant = await f.call('POST', base, head(), { kind: 'amc', machineId: M_B });
    expect(otherPlant.statusCode).toBe(422);
    expect(otherPlant.json().error.field).toBe('machineId');

    const off = await f.call('POST', base, head(), {
      kind: 'legal',
      machineId: M_FREE,
      ownerPersonId: inactiveOwner,
    });
    expect(off.statusCode).toBe(422);
    expect(off.json().error.field).toBe('ownerPersonId');

    const lead = await f.call('POST', base, head(), { kind: 'amc', leadDays: '4000' });
    expect(lead.statusCode).toBe(422);
    expect(lead.json().error.field).toBe('leadDays');

    const kind = await f.call('POST', base, head(), { kind: 'inspection' });
    expect(kind.statusCode).toBe(422);
    expect(kind.json().error.field).toBe('kind');
  });

  it('answers 404 for another plant’s row id', async () => {
    const res = await f.call('PUT', `${base}/${foreign}`, head(), { notes: 'mine now' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.field).toBe('id');
  });

  it('removes the row with its reason on the audit line, then it is gone', async () => {
    const before = (await f.call('GET', base, head()))
      .json()
      .items.find((row: { id: string }) => row.id === created);
    const res = await f.call('PUT', `${base}/${created}`, head(), {
      active: false,
      reason: 'Contract ended',
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ ...before, active: false });
    expect((await f.call('GET', base, head())).json().items).not.toContainEqual(
      expect.objectContaining({ id: created }),
    );
    const lines = await audits(created);
    expect(lines.map((line) => line.action)).toEqual([
      'register.create',
      'register.update',
      'register.remove',
    ]);
    expect(lines[2]!.before).toMatchObject({
      id: created,
      kind: 'warranty',
      notes: 'Mitsubishi EWC',
    });
    expect(lines[2]!.after).toEqual({ reason: 'Contract ended' });
    expect((await f.call('PUT', `${base}/${created}`, head(), { active: false })).statusCode).toBe(
      404,
    );
  });

  it('refuses a technician or an operator the whole screen', async () => {
    for (const role of ['technician', 'operator'] as const) {
      const token = f.tokens[role]!;
      expect((await f.call('GET', base, token)).statusCode).toBe(403);
      expect((await f.call('POST', base, token, { kind: 'amc' })).statusCode).toBe(403);
      expect((await f.call('PUT', `${base}/${foreign}`, token, { notes: 'x' })).statusCode).toBe(
        403,
      );
    }
  });
});
