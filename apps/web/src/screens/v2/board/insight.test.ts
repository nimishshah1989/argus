// @vitest-environment node
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { realT } from '../printed-page/test-support.js';
import { boardModel, dayLabel } from './adapter.js';
import { fixtureConfig, fixtureState, fixtureToday } from './fixture.js';

/**
 * Ticket 772 (S30 Board, ADR 0045 T6): the figures the model prints over the wireframe's plant (ADR 0034: figures
 * only, no wording). 12 machines on the board, 8 stopped; PR-02 has waited longest with nobody started; CP-02 is over
 * a day old; the day score is 14 min / 52 min.
 */
const build = (tv: boolean) =>
  boardModel({ state: fixtureState, config: fixtureConfig, today: fixtureToday, tv }, realT);
const phone = () => build(false);
const tv = () => build(true);
const column = (model: ReturnType<typeof build>, id: string) =>
  model.columns.find((c) => c.column === id)!;

describe('S30 board: the figures', () => {
  it('counts the pulse over the machines the board shows', () => {
    expect(phone().pulse).toMatchObject({ running: 4, stopped: 8, machines: 12 });
    expect(phone().pulse.of).toContain('12');
  });

  it('puts every stop in its column, oldest first, with its age and cell', () => {
    expect(phone().columns.map((c) => [c.column, c.count])).toEqual([
      ['notStarted', 3],
      ['repairing', 4],
      ['waiting', 1],
    ]);
    expect(column(phone(), 'notStarted').rows.map((r) => [r.code, r.age])).toEqual([
      ['PR-02', '5 h 10 min'],
      ['LT-08', '2 h 39 min'],
      ['VC-17', '12 min'],
    ]);
    expect(column(phone(), 'repairing').rows.map((r) => r.code)).toEqual([
      'CP-02',
      'CP-01',
      'LT-02',
      'VC-03',
    ]);
    expect(column(phone(), 'notStarted').rows[0]!.sub).toContain('Cell 4');
    expect(column(phone(), 'waiting').rows[0]!.sub).toContain('Spare part (vendor)');
  });

  it('counts the ages in their four buckets', () => {
    expect(phone().ages.buckets.map((b) => [b.key, b.count])).toEqual([
      ['underHour', 2],
      ['oneToFour', 4],
      ['fourToDay', 1],
      ['overDay', 1],
    ]);
  });

  it('gives each day tile its value and its basis', () => {
    const [response, repair] = phone().today;
    expect(response).toMatchObject({ id: 'response', value: '14 min' });
    expect(response!.note).toMatch(/\b9\b.*\b6\b/);
    expect(repair).toMatchObject({ id: 'repair', value: '52 min' });
    expect(repair!.note).toMatch(/\b6\b.*\b6\b/);
  });

  it('names the longest unstarted wait and the day-old count, and marks that one machine', () => {
    const line = phone().takeaways['board.stops'];
    expect(line?.text).toContain('PR-02');
    expect(line?.text).toContain('5 h 10 min');
    expect(line?.outlier).toBe('m-PR-02');
    const longest = phone()
      .columns.flatMap((c) => c.rows)
      .filter((r) => r.longest);
    expect(longest.map((r) => r.code)).toEqual(['PR-02']);
  });

  it('says how many of the stops are under 1 h', () => {
    expect(phone().takeaways['board.ages']?.text).toContain('2 of 8');
  });

  it('on the TV: the 3 oldest rows per column and how many more, the clock in the plant time zone', () => {
    const repairing = column(tv(), 'repairing');
    expect(repairing.count).toBe(4);
    expect(repairing.rows.map((r) => r.code)).toEqual(['CP-02', 'CP-01', 'LT-02']);
    expect(repairing.more).toContain('1');
    expect(column(phone(), 'repairing').more).toBeNull();
    expect(tv().clock).toEqual({ time: '10:44', day: 'Tue 24 Nov' });
    expect(phone().clock).toBeNull();
    expect(tv().updated).toContain('10:44');
  });

  it('says the day in the plant time zone, not the device one', () => {
    expect(dayLabel('2026-11-24T05:14:00.000Z', 'Asia/Kolkata')).toBe('Tue 24 Nov');
    expect(dayLabel('2026-11-24T20:00:00.000Z', 'Asia/Kolkata')).toBe('Wed 25 Nov');
  });
});
