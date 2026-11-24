import { describe, expect, it } from 'vitest';
import { monthRange } from '../../analytics/pm-calendar-view.js';
import { realT } from '../printed-page/test-support.js';
import { pmCalendarModel } from '../pm-calendar/adapter.js';
import { TODAY, calendarFor } from '../pm-calendar/stand-in.js';

/**
 * Ticket 673, hidden (ADR 0034): with no compliance figure the rate tiles print a dash, and nothing may invent a rate
 * for them: no yardstick figure on a dash tile, no number in the judged line. A takeaway is still there for every section.
 */
describe('PM Calendar insight with no compliance figure (ticket 673, hidden)', () => {
  const model = pmCalendarModel(
    {
      calendar: calendarFor(monthRange(TODAY)),
      compliance: undefined,
      asOf: TODAY,
      canMove: false,
    },
    realT,
  );

  it('compares no dash tile with anything', () => {
    const dashes = model.figures.filter((f) => f.value === '—');
    expect(dashes.map((f) => f.id).sort()).toEqual(['pm', 'schedule']);
    for (const tile of dashes) expect(tile.yardstick ?? '', tile.id).not.toMatch(/\d/);
  });

  it('says no rate in the judged line', () => {
    const text = model.takeaways?.judged?.text ?? '';
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/\d/);
  });
});
