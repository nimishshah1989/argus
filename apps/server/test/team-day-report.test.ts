import { withTenant } from '@uptimo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDayReport } from '../src/modules/reports/day-report.js';
import { loadTeamDayReport } from '../src/modules/reports/team-report.js';
import { pdfShows } from './pdf-text.js';
import { startRealPlant, type RealPlant } from './real-plant.js';

let plant: RealPlant;
let date = '';
const tokens: Record<string, string> = {};
const GUJARATI_NAME = 'ગીતા પટેલ';

const teamRaw = (shift: string | null) =>
  withTenant(plant.db.app, plant.tenantId, (client) =>
    loadTeamDayReport(client, { tenantId: plant.tenantId, date, shift }),
  );
async function team(shift: string | null) {
  const data = await teamRaw(shift);
  if (data === 'no-shift' || data === null) throw new Error('no team report');
  return data;
}
const person = (personId: string, shift: string | null) =>
  withTenant(plant.db.app, plant.tenantId, (client) =>
    loadDayReport(client, { tenantId: plant.tenantId, personId, date, shift }),
  );
const pdf = (query: string, who: string) =>
  plant.get(`/api/v1/reports/day.pdf?date=${date}&${query}`, tokens[who] as string);

beforeAll(async () => {
  plant = await startRealPlant();
  // A real day (Asia/Kolkata) when production people did hands-on work alongside the maintenance team.
  date = '2026-11-04';
  for (const role of [
    'plant_head',
    'supervisor',
    'head',
    'admin',
    'technician',
    'operator',
    'board',
  ]) {
    tokens[role] = await plant.signIn({ username: `t-${role}`, role });
  }
}, 300_000);

afterAll(async () => {
  await plant.stop();
});

const IST_DAY = (day: string): [string, string] => [
  new Date(`${day}T00:00:00+05:30`).toISOString(),
  new Date(new Date(`${day}T00:00:00+05:30`).getTime() + 86_400_000).toISOString(),
];

describe('the team day report data', () => {
  it('lists everyone who worked in the window, whatever their team, and adds up to each person’s own report', async () => {
    const data = await team(null);
    const [start, end] = IST_DAY(date);
    const worked = (
      await plant.db.admin.query(
        `SELECT person_id AS id FROM work_segment WHERE started_at < $2 AND COALESCE(ended_at, $2) > $1
         UNION SELECT acting_person_id FROM ticket_event
          WHERE acting_person_id IS NOT NULL AND at >= $1 AND at < $2`,
        [start, end],
      )
    ).rows.map((row) => row.id as string);
    expect(data.people.map((row) => row.person.id).sort()).toEqual(worked.sort());
    const teams = (
      await plant.db.admin.query('SELECT id, team FROM person WHERE id = ANY($1::uuid[])', [worked])
    ).rows;
    const production = teams.filter((row) => row.team === 'production').map((row) => row.id);
    expect(production.length, 'production people worked this day').toBeGreaterThan(0);
    let ownTotal = 0;
    for (const row of data.people) {
      const own = (await person(row.person.id, null)) as { totalMinutes: number; jobs: unknown[] };
      expect(row.totalMinutes).toBe(own.totalMinutes);
      expect(row.jobs).toEqual(own.jobs);
      ownTotal += own.totalMinutes;
    }
    expect(data.totalMinutes).toBe(ownTotal);
    const productionMinutes = data.people
      .filter((row) => production.includes(row.person.id))
      .reduce((sum, row) => sum + row.totalMinutes, 0);
    expect(productionMinutes).toBeGreaterThan(0);
  });

  it('splits each person’s minutes into primary and support that add up to the same total', async () => {
    const data = await team(null);
    for (const row of data.people) {
      expect(row.primaryMinutes + row.supportMinutes).toBe(row.totalMinutes);
      for (const job of row.jobs) {
        expect(job.primaryMinutes + job.supportMinutes).toBe(job.minutes);
        if (job.minutes > 0) expect(job.roles.length).toBeGreaterThan(0);
      }
    }
    expect(data.people.some((row) => row.supportMinutes > 0)).toBe(true);
  });

  it('never calls a ticket closed and pending at once, and counts a person’s closes as the ones they closed', async () => {
    for (const shift of ['1', null]) {
      const data = await team(shift);
      const pending = new Set(data.pending.map((row) => row.ticketId));
      const closed = data.people.flatMap((row) =>
        row.jobs.filter((job) => job.stateAtEnd === 'closed').map((job) => job.ticketId),
      );
      expect(closed.filter((id) => pending.has(id))).toEqual([]);
      expect(data.closedCount).toBe(new Set(closed).size);
      const distinct = new Set(data.people.flatMap((row) => row.jobs.map((job) => job.ticketId)));
      expect(data.jobCount).toBe(distinct.size);
      for (const row of data.people) {
        const byThem = (
          await plant.db.admin.query(
            `SELECT count(*)::int AS n FROM ticket
              WHERE id = ANY($1::uuid[]) AND closed_by_person_id = $2 AND closed_at < $3`,
            [row.jobs.map((job) => job.ticketId), row.person.id, data.window.end],
          )
        ).rows[0].n;
        expect(row.closedCount).toBe(byThem);
      }
    }
  });

  it('covers the whole calendar day when no shift is chosen, and says no to a shift the plant lacks', async () => {
    expect((await team(null)).totalMinutes).toBeGreaterThanOrEqual((await team('1')).totalMinutes);
    expect(await teamRaw('day')).toBe('no-shift');
  });

  it('shows nobody from another plant', async () => {
    const other = await plant.db.admin.query(
      "INSERT INTO tenant (slug, name) VALUES ('plant-two', 'Plant Two') RETURNING id",
    );
    const data = await withTenant(plant.db.app, other.rows[0].id, (client) =>
      loadTeamDayReport(client, { tenantId: other.rows[0].id, date, shift: null }),
    );
    expect((data as { people: unknown[] }).people).toEqual([]);
    expect((data as { pending: unknown[] }).pending).toEqual([]);
  });
});

describe('the team day report PDF', () => {
  it('is what the plant head gets by default, as one PDF for the whole team', async () => {
    const res = await pdf('shift=1', 'plant_head');
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.headers['content-disposition']).toContain(`Day_report_Team_${date}_shift1.pdf`);
  });

  it('refuses the plant head a single person’s report, because their view is the team', async () => {
    const someone = (await plant.db.admin.query('SELECT id FROM person LIMIT 1')).rows[0].id;
    const res = await pdf(`personId=${someone}&shift=1`, 'plant_head');
    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/team/i);
  });

  it.each(['supervisor', 'head', 'admin'])('lets a %s ask for the team', async (role) => {
    expect((await pdf('team=1&shift=1', role)).statusCode).toBe(200);
  });

  it.each(['technician', 'operator', 'board'])('does not give the team to a %s', async (role) => {
    expect((await pdf('team=1&shift=1', role)).statusCode).toBe(403);
  });

  it('prints Gujarati names', async () => {
    const data = await team('1');
    const first = data.people[0]!.person.id;
    await plant.db.admin.query('UPDATE person SET name = $2 WHERE id = $1', [first, GUJARATI_NAME]);
    const res = await pdf('team=1&shift=1', 'supervisor');
    expect(res.statusCode).toBe(200);
    expect(pdfShows(res.rawPayload, GUJARATI_NAME)).toBe(true);
  });
});

describe('someone switched off since', () => {
  it('stays in the history of the days they worked', async () => {
    const before = await team(null);
    const gone = before.people[0]!.person.id;
    await plant.db.admin.query('UPDATE person SET active = false WHERE id = $1', [gone]);
    const after = await team(null);
    expect(after.people.map((row) => row.person.id)).toContain(gone);
    expect(after.totalMinutes).toBe(before.totalMinutes);
  });
});
