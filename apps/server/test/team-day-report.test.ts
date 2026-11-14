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
  // The real day with the most different people at work in shift 1 (08:00–18:30, Asia/Kolkata).
  date = (
    await plant.db.admin.query(
      `SELECT to_char(started_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS date
         FROM work_segment
        WHERE (started_at AT TIME ZONE 'Asia/Kolkata')::time BETWEEN '08:00' AND '18:00'
        GROUP BY 1 ORDER BY count(DISTINCT person_id) DESC, 1 LIMIT 1`,
    )
  ).rows[0].date;
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

describe('the team day report data', () => {
  it('lists each maintenance person who worked in the window, with the minutes the person’s own report shows', async () => {
    const data = await team('1');
    expect(data.people.length).toBeGreaterThan(1);
    const maintenance = (
      await plant.db.admin.query(
        "SELECT id FROM person WHERE tenant_id = $1 AND active AND team = 'maintenance'",
        [plant.tenantId],
      )
    ).rows.map((row) => row.id as string);
    const worked: string[] = [];
    for (const id of maintenance) {
      const own = await person(id, '1');
      if (own !== 'no-shift' && own !== null && own.jobs.length > 0) worked.push(id);
    }
    expect(data.people.map((row) => row.person.id).sort()).toEqual(worked.sort());
    for (const row of data.people) {
      const own = await person(row.person.id, '1');
      expect(row.totalMinutes).toBe((own as { totalMinutes: number }).totalMinutes);
      expect(row.jobs).toEqual((own as { jobs: unknown[] }).jobs);
    }
    expect(data.totalMinutes).toBe(data.people.reduce((sum, row) => sum + row.totalMinutes, 0));
    expect(data.jobCount).toBeLessThanOrEqual(
      data.people.reduce((sum, row) => sum + row.jobs.length, 0),
    );
    expect(data.jobCount).toBeGreaterThan(0);
  });

  it('covers the whole calendar day when no shift is chosen, and says no to a shift the plant lacks', async () => {
    const whole = await team(null);
    const shift = await team('1');
    expect(whole.totalMinutes).toBeGreaterThanOrEqual(shift.totalMinutes);
    expect(await teamRaw('day')).toBe('no-shift');
  });

  it('shows nobody from another plant', async () => {
    const other = await plant.db.admin.query(
      "INSERT INTO tenant (slug, name) VALUES ('plant-two', 'Plant Two') RETURNING id",
    );
    const data = await withTenant(plant.db.app, other.rows[0].id, (client) =>
      loadTeamDayReport(client, { tenantId: other.rows[0].id, date, shift: null }),
    );
    expect((data as { people: unknown[]; pending: unknown[] }).people).toEqual([]);
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
