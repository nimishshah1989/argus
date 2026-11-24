import { describe, expect, it } from 'vitest';
import { monthRange } from '../../analytics/pm-calendar-view.js';
import { hasYardstick, tilesIn } from '../insight.js';
import { realT } from '../printed-page/test-support.js';
import { pmCalendarModel } from './adapter.js';
import type { CalendarRange } from '../../../ui/v2/domain/calendar-events.js';
import { COMPLIANCE, TODAY, calendarFor } from './stand-in.js';

/**
 * Ticket 673 (ADR 0035): each section opens with one line and every tile names its yardstick. Critical tests only
 * (ADR 0034): the figures in each line, never its wording. The gallery month (Nov 2026: 10 jobs, one a day) and the
 * six-week grid of `pm-calendar.test.ts` (27 jobs on 25 days; 01-Feb and 15-Feb-2027 hold two each; 20 in February).
 */
const ask = (range: CalendarRange) =>
  pmCalendarModel(
    { calendar: calendarFor(range), compliance: COMPLIANCE, asOf: TODAY, canMove: true },
    realT,
  );
const gallery = ask(monthRange(TODAY));
const grid = ask({ from: '2027-01-25', to: '2027-03-07' });
const SECTIONS = ['calendar', 'judged', 'jobs', 'spread'];
const line = (model: typeof grid, id: string) => model.takeaways?.[id]?.text ?? '';
const yardstick = (model: typeof grid, id: string) =>
  model.figures.find((f) => f.id === id)?.yardstick ?? '';
const has = (text: string, figures: string[]) => {
  for (const figure of figures) expect(text).toContain(figure);
};

describe('PM Calendar insight (ticket 673)', () => {
  it('gives every section a takeaway and every tile a yardstick', () => {
    for (const model of [gallery, grid]) {
      expect(Object.keys(model.takeaways ?? {}).sort()).toEqual(SECTIONS);
      for (const id of SECTIONS) expect(line(model, id).length, id).toBeGreaterThan(0);
      expect(
        tilesIn(model)
          .filter((tile) => !hasYardstick(tile))
          .map((t) => t.id),
      ).toEqual([]);
    }
  });

  it('holds every PM day of the range against the one-a-day cap', () => {
    has(line(gallery, 'calendar'), ['10']);
    has(line(grid, 'calendar'), ['2', '25', '01-Feb-2027']);
  });

  it('holds the month’s jobs table to the same cap, over the month only', () => {
    has(line(gallery, 'jobs'), ['10']);
    has(line(grid, 'jobs'), ['2', '18', '01-Feb-2027']);
  });

  it('counts the PM jobs that share a day', () => {
    has(line(grid, 'spread'), ['4']);
  });

  it('measures each rate against the other, and the crowding and load against the jobs in view', () => {
    has(yardstick(grid, 'pm'), ['27.3']);
    has(yardstick(grid, 'schedule'), ['25.0']);
    has(yardstick(grid, 'crowded'), ['15%', '27']);
    has(yardstick(gallery, 'crowded'), ['0%', '10']);
    has(yardstick(grid, 'jobs'), ['1.1']);
    has(yardstick(gallery, 'jobs'), ['1.0']);
  });
});
