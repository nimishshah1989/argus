// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { actorFrom, quickSpec } from '../../../components/actionSpecs.js';
import { realT } from '../printed-page/test-support.js';
import { mineModel, teamModel } from './team-adapter.js';
import { ME, mineFixture, teamFixture } from './team-fixture.js';
import { mineQuery } from './team-model.js';

/**
 * S28-B (ADR 0045 T4): Mine and Team figures over the frozen plant. ADR 0034: figures, permissions and data
 * safety only; sentences are checked by the names and numbers in them.
 */
const team = () => teamModel(teamFixture, realT);
const mine = () => mineModel(mineFixture, realT);
const rows = (list: { ref: string; machine: string; detail: string; time: string }[]) =>
  list.map(({ ref, machine, detail, time }) => [ref, machine, detail, time]);

describe('whose jobs Mine reads', () => {
  it('a personal login reads its acting person’s working, waiting and closed jobs', () => {
    expect(mineQuery(ME)).toEqual({ personId: 'p1', status: ['working', 'waiting', 'closed'] });
  });

  it('a shared (kiosk) login reads everyone’s, never one person’s', () => {
    const query = mineQuery({ ...ME, shared: true });
    expect(query).toEqual({ status: ['working', 'waiting', 'closed'] });
    expect('personId' in query).toBe(false);
  });
});

describe('Mine over the frozen plant', () => {
  it('splits my jobs into In progress and Waiting cards with the role’s quick button', () => {
    const m = mine();
    expect(m.state).toBe('ready');
    expect(m.inProgress.map((card) => [card.ticket.ref, card.machine])).toEqual([
      ['TKT-0409', 'LT-08'],
    ]);
    expect(m.waiting.map((card) => [card.ticket.ref, card.machine])).toEqual([
      ['TKT-0392', 'GRD-07'],
    ]);
    const actor = actorFrom(ME)!;
    for (const card of [...m.inProgress, ...m.waiting])
      expect(card.quick, card.ticket.ref).toEqual(quickSpec(card.ticket, actor));
    expect(m.empty).toBeNull();
  });

  it('lists my closed jobs of the last 30 days, newest first, and drops older ones', () => {
    expect(mine().closed.map((row) => [row.ref, row.machine, row.time])).toEqual([
      ['TKT-0381', 'DRL-04', '8 h 20 min ago'],
      ['TKT-0360', 'VC-03', '25 d 20 h ago'],
    ]);
  });

  it('points the day report at today’s PDF and names the file by the date', () => {
    expect(mine().dayReport).toEqual({
      href: '/api/v1/reports/day.pdf?date=2026-11-25',
      file: 'day-report-2026-11-25.pdf',
    });
  });
});

describe('Team over the frozen plant', () => {
  it('Working now: everyone on a job with their crew role, the longest job first, then paused jobs, longest wait first', () => {
    const { working, paused } = team();
    expect(
      [...working, ...paused].map((r) => [r.ref, r.machine, r.name, r.role, r.state, r.minutes]),
    ).toEqual([
      ['TKT-0409', 'LT-08', 'Tech A', 'Lead', 'In progress', '2 h 24 min'],
      ['TKT-0414', 'CNC-02', 'Tech B', 'Lead', 'In progress', '2 h 0 min'],
      ['TKT-0414', 'CNC-02', 'Tech A', 'Support', 'In progress', '0 min'],
      ['TKT-0412', 'VC-03', 'Tech B', 'Lead', 'In progress', '30 min'],
      ['TKT-0395', 'VC-17', 'Tech B', 'Lead', 'Waiting · vendor_visit', '30 min'],
      ['TKT-0390', 'GRD-07', 'Tech B', 'Lead', 'Waiting · Spare part', '30 min'],
    ]);
    expect([...working, ...paused].map((r) => r.paused)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it('Working now names the leads alone until the crew is read', () => {
    const leads = teamModel({ ...teamFixture, crew: undefined }, realT).working;
    expect(leads.filter((r) => r.ref === 'TKT-0414').map((r) => r.name)).toEqual(['Tech B']);
  });

  it('Waiting: paused jobs, longest wait first, with the wait reason’s list label and the minutes waited', () => {
    expect(rows(team().waiting)).toEqual([
      ['TKT-0395', 'VC-17', 'vendor_visit', '1 h 30 min'],
      ['TKT-0390', 'GRD-07', 'Spare part', '45 min'],
    ]);
  });

  it('Not started: open jobs with the problem and time since reported (at the plant’s now)', () => {
    expect(rows(team().notStarted)).toEqual([
      ['TKT-0415', 'Civil', 'Fix the store door', '5 min ago'],
      ['TKT-0413', 'HMC-11', 'Spindle noise', '20 min ago'],
    ]);
  });

  it('Cancelled, last 24 hours keeps only the one inside the window', () => {
    const { cancelled } = team();
    expect(cancelled.state).toBe('ready');
    expect(cancelled.rows.map((row) => [row.ref, row.machine, row.time])).toEqual([
      ['TKT-0370', 'DRL-04', '3 h 0 min ago'],
    ]);
  });

  it('Closed, last 30 days: newest first, the 40-day-old job left out', () => {
    expect(team().closed.rows.map((row) => row.ref)).toEqual(['TKT-0380', 'TKT-0381', 'TKT-0360']);
  });

  it('Monthly totals per person: newest month first, primary and support minutes per person', () => {
    expect(
      team().closed.months.map(({ month, label, rows: people }) => [
        month,
        label,
        people.map((p) => [p.name, p.primary, p.support]),
      ]),
    ).toEqual([
      [
        '2026-11',
        'November 2026',
        [
          ['Tech B', '1 h 0 min', null],
          ['Tech A', '45 min', null],
        ],
      ],
      [
        '2026-10',
        'October 2026',
        [
          ['Tech A', '1 h 30 min', null],
          ['Tech B', '0 min', '30 min'],
        ],
      ],
    ]);
  });

  it('names who is on the single longest job, its minutes and machine (not the lead with most minutes in all)', () => {
    const line = team().takeaways['desk.team'];
    expect(line).not.toBeNull();
    expect(line!.text).toContain('Tech A');
    expect(line!.text).toContain('2 h 24 min');
    expect(line!.text).toContain('LT-08');
    expect(line!.tag.length).toBeGreaterThan(0);
  });
});
