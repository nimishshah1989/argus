import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import type { FiguresPart, Page } from '../printed-page/printed.js';
import {
  dayValue,
  figureOf,
  machineChip,
  numberValue,
  pageOf,
  personChips,
  shortDate,
} from '../printed-page/printed.js';
import type { Translate } from '../figures/read.js';
import { drillFor } from '../rows-behind/drill.js';
import type { FixCase, FixFinderModel, FixFinderWords } from './model.js';
import { fixFinderWords } from './words.js';

const KEY = 'fix-finder';
/** The engine's seven columns, in its own order (`fix-finder.ts`): match, date, machine, problem, done, hours, who. */
const COLUMNS = 7;

function caseOf(row: string[], at: number): FixCase {
  const [match = '', date = '', machine = '', problem = '', done = '', down = '', doneBy = ''] =
    row;
  return {
    id: `${date}-${machine}-${at}`,
    match: { shown: match, value: numberValue(match) },
    date: { shown: shortDate(date), value: dayValue(date) },
    machine: machineChip(machine),
    problem,
    done,
    down: { shown: down, value: numberValue(down) },
    doneBy: personChips(doneBy),
  };
}

/** The verdict says what the engine printed: how many cases it found and what they usually cost. */
function verdictOf(page: Page, words: FixFinderWords, source: string): FixFinderModel['verdict'] {
  const [cases, , typical, last] = page.kpis;
  const known = cases !== undefined && typical !== undefined;
  return {
    headline: [
      {
        text: known
          ? fill(words.headline, { count: cases.value, typical: typical.value })
          : words.noFigures,
        tone: 'strong',
      },
    ],
    why: [
      ...(cases?.sub ? [[{ text: cases.sub }]] : []),
      ...(last ? [[{ text: fill(words.lastSeen, { date: shortDate(last.value) }) }]] : []),
    ],
    context: source,
  };
}

/**
 * The Fix Finder model from the engine's reply: the page of the `fix-finder` figure, every figure and every column
 * kept as printed. Null when the engine has no page for it (not computed, or nothing in the log). The engine ranks one
 * fixed phrase for the whole plant, so there is no search here yet (`needs server`, in the coverage table).
 */
export function fixFinderModel(reply: FiguresPart, t: TFunction): FixFinderModel | null {
  const page = pageOf(figureOf(reply, KEY), t);
  const table = page?.tables[0];
  if (page === null || table === undefined || table.rows.length === 0) return null;
  const say: Translate = (key, values) => t(key, { ...values }) as string;
  const words = fixFinderWords(t, table.rows.length);
  const source = fill(words.source, { date: shortDate(reply.asOf) });
  return {
    verdict: verdictOf(page, words, source),
    figures: page.kpis.map((kpi, at) => ({
      id: `kpi-${at}`,
      ...kpi,
      sub: kpi.sub ?? '',
      ...(at === 0 ? { drill: drillFor(reply, KEY, say) } : {}),
    })),
    cases: table.rows.filter((row) => row.length >= COLUMNS).map(caseOf),
    source,
    words: table.title === '' ? words : { ...words, cases: { ...words.cases, title: table.title } },
  };
}
