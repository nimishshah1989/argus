import i18n from '../../../i18n/index.js';
import { withInsight } from './adapter.js';
import { RAW } from './fixture-actions.js';
import { actionRows, kpis, startList, verdict } from './fixture-build.js';
import { isOpen, loads, rebalance, suggestions } from './fixture-load.js';
import { teamFocusWords } from './fixture-words.js';
import type { TeamFocusModel } from './model.js';

/**
 * Team Focus's invented gallery data: 24 actions of the month on the Dashboard's machines, owned by the three
 * invented people. Every figure is added up from those rows (fixture tests check): the key figures, the verdict, each
 * person's load and the list all read the same 24.
 */
const people = loads(RAW);
const unowned = RAW.filter((r) => isOpen(r) && r.owner === null);

export const teamFocusFixture: TeamFocusModel = withInsight(
  {
    verdict: verdict(RAW, people),
    kpis: kpis(RAW),
    start: startList(RAW, suggestions(RAW, unowned), people),
    people,
    rebalance: rebalance(RAW, people),
    actions: actionRows(RAW),
    source: 'Figures as of 20-Nov-2026 09:30 IST · source: the Argus action plan and breakdown log',
    words: teamFocusWords(RAW.length, people.length),
  },
  i18n.t.bind(i18n),
);
