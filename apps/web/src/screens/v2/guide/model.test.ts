// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GUIDE_ENTRIES } from '../../analytics/guide-entries.js';
import { GROUP_OF, guideModel, shownEntries } from './model.js';

const model = () => guideModel();

describe('S25 Guide model', () => {
  it('files every entry under a topic, and only the unbuilt ones under none', () => {
    expect(GUIDE_ENTRIES.map((e) => e.id).filter((id) => !(id in GROUP_OF))).toEqual([]);
    expect(GUIDE_ENTRIES.filter((e) => GROUP_OF[e.id] === null).map((e) => e.built)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('draws the chips in the wireframe’s order with their counts', () => {
    expect(model().chips.map((c) => [c.id, c.count])).toEqual([
      ['all', 36],
      ['basics', 6],
      ['overview', 2],
      ['reliability', 3],
      ['problems', 7],
      ['machines', 5],
      ['people-money', 3],
      ['reports-data', 3],
      ['planning', 3],
      ['unbuilt', 4],
    ]);
    expect(model().chips[1]!.label).toBe('analytics.guide.group.basics');
    expect(model().chips[0]!.label).toBe('analytics.guide.all');
    expect(model().chips[9]!.label).toBe('analytics.guide.unbuilt');
  });

  it('says which topic has the most and how many are not built', () => {
    expect(model().takeaway).toEqual({ group: 'problems', n: 7, total: 36, unbuilt: 4 });
  });

  it('numbers the entries after "How this platform works" and anchors each one', () => {
    expect(model().items[0]).toMatchObject({ n: null, anchor: 'guide-how', group: 'basics' });
    expect(model().items[1]).toMatchObject({ n: 1, anchor: 'guide-ground-rules' });
    expect(model().items[35]).toMatchObject({ n: 35, anchor: 'guide-amc-legal', group: null });
  });

  it('a chip filters the entries; All keeps every one', () => {
    expect(shownEntries(model(), 'all')).toHaveLength(36);
    expect(shownEntries(model(), 'overview').map((i) => i.entry.id)).toEqual([
      'dashboard',
      'action-center',
    ]);
    expect(shownEntries(model(), 'unbuilt').map((i) => i.entry.id)).toEqual([
      'oem',
      'learning',
      'no-code',
      'amc-legal',
    ]);
  });
});
