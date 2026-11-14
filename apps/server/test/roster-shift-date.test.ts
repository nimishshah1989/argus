import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { onRosterAt } from '../src/modules/accountability/roster.js';
import { startTestDb, type TestDb } from './harness.js';

/** Plant time is Asia/Kolkata (+05:30). The roster is read for the shift running at an instant and that shift's date. */
const TENANT = '84000000-0000-0000-0000-000000000001';
const PERSON = randomUUID();
const DAY_SHIFT = randomUUID();
const OLD_NIGHT = randomUUID();
const NIGHT = randomUUID();
const ist = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:30`);

let db: TestDb;
let admin: Pool;

const onRoster = (at: Date) =>
  withTenant(db.app, TENANT, (client) => onRosterAt(client, TENANT, PERSON, at));

async function rosterOnly(date: string, shift: string): Promise<void> {
  await admin.query('DELETE FROM roster_entry WHERE tenant_id = $1', [TENANT]);
  await admin.query(
    "INSERT INTO roster_entry (tenant_id, date, shift_id, person_id, level) VALUES ($1, $2, $3, $4, 'L1')",
    [TENANT, date, shift, PERSON],
  );
}

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'rsd', 'Shift date')", [
    TENANT,
  ]);
  await admin.query(
    "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, 'Duty', 'maintenance')",
    [PERSON, TENANT],
  );
  await admin.query(
    `INSERT INTO shift (id, tenant_id, code, name, starts_at, ends_at, crosses_midnight, active) VALUES
      ($1, $4, 'D', 'Day', '06:00', '14:00', false, true),
      ($2, $4, 'N0', 'Old night, switched off', '22:00', '08:00', true, false),
      ($3, $4, 'N', 'Night', '14:00', '06:00', true, true)`,
    [DAY_SHIFT, OLD_NIGHT, NIGHT, TENANT],
  );
}, 120_000);

afterAll(async () => {
  await db.stop();
});

describe('the roster line for the shift running now', () => {
  it('uses the running shift for the date too: a switched-off later-starting night shift does not shift the day', async () => {
    // 07:00 on 10 March: the Day shift runs, and so does the date 10 March. The switched-off 22:00 to 08:00 shift
    // also covers 07:00 and starts later, but it is off and must not decide the date.
    await rosterOnly('2026-03-10', DAY_SHIFT);
    expect(await onRoster(ist('2026-03-10', '07:00'))).toBe(true);
    await rosterOnly('2026-03-09', DAY_SHIFT);
    expect(await onRoster(ist('2026-03-10', '07:00'))).toBe(false);
  });

  it('puts the hours after midnight of a night shift on the day the shift started', async () => {
    await rosterOnly('2026-03-09', NIGHT);
    expect(await onRoster(ist('2026-03-10', '03:00'))).toBe(true);
    expect(await onRoster(ist('2026-03-09', '23:00'))).toBe(true);
    await rosterOnly('2026-03-10', NIGHT);
    expect(await onRoster(ist('2026-03-10', '03:00'))).toBe(false);
    expect(await onRoster(ist('2026-03-10', '23:00'))).toBe(true);
  });
});
