// @vitest-environment node
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import key from '../../../../../../fixtures/answer-key/data-checklist.json' with { type: 'json' };
import { hasYardstick, tilesIn } from '../insight.js';
import { keyReply } from '../printed-page/key-reply.js';
import { realT } from '../printed-page/test-support.js';
import { dataChecklistFixture as gallery } from './fixture.js';
import { KEY, liveChecklist } from './live.js';
import type { DataChecklistModel } from './model.js';

/**
 * Ticket 675 (ADR 0035): the failing checks, the records and the passing list each open with one line, and every KPI
 * names its yardstick, live and in the gallery. Critical tests only (ADR 0034): figures, never wording. The engine's
 * 11 Nov answer key: 245 records on 105 machines and people, 11 failing checks (Done By 82, Observed By 36, power 36),
 * 5 checks pass; 136 log, 86 machines, 23 analysis.
 */
const live = liveChecklist(
  keyReply(KEY, 1, { asOf: key.asOf, ...key.extra } as { asOf: string }),
  realT,
);
const SECTIONS = ['groups', 'passing', 'records'];
const has = (text: string | undefined, figures: string[]) => {
  for (const figure of figures) expect(text ?? '').toContain(figure);
};
const yardstick = (model: DataChecklistModel, id: string) =>
  model.kpis.find((k) => k.id === id)?.yardstick;

describe('Data Checklist insight (ticket 675)', () => {
  it('gives every section a takeaway and every KPI a yardstick, live and in the gallery', () => {
    for (const model of [live, gallery]) {
      expect(Object.keys(model.takeaways ?? {}).sort()).toEqual(SECTIONS);
      for (const id of SECTIONS) expect(model.takeaways?.[id]?.text.length, id).toBeGreaterThan(0);
      expect(tilesIn(model).filter((tile) => !hasYardstick(tile))).toEqual([]);
    }
  });

  it('says how few checks hold most of the records', () => {
    has(live.takeaways?.groups?.text, ['3', '11', '63%']);
    has(gallery.takeaways?.groups?.text, ['Breakdowns without a problem code', '4.8', '12']);
  });

  it('reads every record, not the rows a filter leaves', () => {
    has(live.takeaways?.records?.text, ['21', '105', '51%']);
    has(gallery.takeaways?.records?.text, ['TC-4', '1.8']);
  });

  it('counts the checks that pass', () => {
    has(live.takeaways?.passing?.text, ['5']);
    has(gallery.takeaways?.passing?.text, ['7']);
  });

  it('measures each part’s records against all of them, and the total against zero', () => {
    has(yardstick(live, 'records'), ['0']);
    has(yardstick(live, 'log'), ['56%', '245']);
    has(yardstick(live, 'machines'), ['35%', '245']);
    has(yardstick(live, 'analysis'), ['9%', '245']);
  });
});
