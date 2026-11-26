// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GUIDE_ENTRIES } from '../../analytics/guide-entries.js';
import { guideModel, shownEntries } from '../guide/model.js';

describe('S25 Guide: edges', () => {
  it('computes the takeaway from the entries, never a fixed topic', () => {
    const planning = GUIDE_ENTRIES.filter((e) =>
      ['forecast-planning', 'forecast-lab', 'pm-calendar'].includes(e.id),
    );
    const m = guideModel(planning);
    expect(m.takeaway).toEqual({ group: 'planning', n: 3, total: 3, unbuilt: 0 });
    expect(m.chips.find((c) => c.id === 'problems')!.count).toBe(0);
  });

  it('on a tie the topic first in chip order wins', () => {
    const tie = GUIDE_ENTRIES.filter((e) => ['dashboard', 'mttr-mtbf'].includes(e.id));
    expect(guideModel(tie).takeaway.group).toBe('overview');
  });

  it('chip counts always add up to All', () => {
    const m = guideModel();
    const sum = m.chips.filter((c) => c.id !== 'all').reduce((s, c) => s + c.count, 0);
    expect(sum).toBe(m.chips[0]!.count);
    for (const chip of m.chips) expect(shownEntries(m, chip.id)).toHaveLength(chip.count);
  });
});
