// @vitest-environment node
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import key from '../../../../../../fixtures/answer-key/team-focus.json' with { type: 'json' };
import { hasYardstick, tilesIn } from '../insight.js';
import { keyReply } from '../printed-page/key-reply.js';
import { realT } from '../printed-page/test-support.js';
import { teamFocusFixture as gallery } from './fixture.js';
import { KEY, liveTeamFocus } from './live.js';
import type { TeamFocusModel } from './model.js';

/**
 * Ticket 676 (ADR 0035): "Needs an owner", the people and the actions each open with one line, and every KPI names
 * its yardstick, live and in the gallery. Critical tests only (ADR 0034): figures, never wording. The engine's 11 Nov
 * answer key: 31 open actions, none owned, 253.96 h; Fix for good holds 144.75 h of six lanes. The gallery: 24
 * actions, 19 open, 4 unowned; Arjun V carries 93.4 h.
 */
const live = liveTeamFocus(keyReply(KEY, 1, key as { asOf: string }, 'machine'), {}, realT);
const SECTIONS = ['actions', 'people', 'start'];
const has = (text: string | undefined, figures: string[]) => {
  for (const figure of figures) expect(text ?? '').toContain(figure);
};
const yardstick = (model: TeamFocusModel, id: string) =>
  model.kpis.find((k) => k.id === id)?.yardstick;

describe('Team Focus insight (ticket 676)', () => {
  it('gives every section a takeaway and every KPI a yardstick, live and in the gallery', () => {
    for (const model of [live, gallery]) {
      expect(Object.keys(model.takeaways ?? {}).sort()).toEqual(SECTIONS);
      for (const id of SECTIONS) expect(model.takeaways?.[id]?.text.length, id).toBeGreaterThan(0);
      expect(tilesIn(model).filter((tile) => !hasYardstick(tile))).toEqual([]);
    }
  });

  it('says how few unowned actions hold most of the hours', () => {
    has(live.takeaways?.start?.text, ['5', '31', '56%']);
    has(gallery.takeaways?.start?.text, ['Overhaul or replace the turning centre', '2.7', '18.8']);
  });

  it('names the person who carries the most, and invents no one when nobody owns anything', () => {
    has(gallery.takeaways?.people?.text, ['Arjun V', '5.9', '93.4']);
    expect(live.takeaways?.people?.text ?? '').not.toMatch(/\d/);
  });

  it('reads every open action by lane, not the rows a filter leaves', () => {
    has(live.takeaways?.actions?.text, ['1', '6', '57%']);
    has(gallery.takeaways?.actions?.text, ['2', '6', '65%']);
  });

  it('measures the open, the unowned and the hours against the month’s actions', () => {
    has(yardstick(live, 'open'), ['100%', '31']);
    has(yardstick(live, 'unowned'), ['100%', '31']);
    has(yardstick(live, 'stake'), ['8.19']);
    has(yardstick(gallery, 'open'), ['79%', '24']);
    has(yardstick(gallery, 'unowned'), ['21%', '19']);
    has(yardstick(live, 'progress'), ['100%']);
  });
});
