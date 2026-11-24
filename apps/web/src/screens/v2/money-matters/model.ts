import type { Drill } from '../../../ui/v2/drill.js';
import type { FigureData } from '../../../ui/v2/figure-tile.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import type { PageChart, PageWords } from '../printed-page/page-model.js';
import type { PrintedTable } from '../printed-page/table.js';

/**
 * One heading of tiles (wireframe S22): `cost` = money lost, same per year, could have been added, open Team Focus
 * actions; `next` = next month expected, plan for (80%), worst case (90%), average month so far; `price` = throughput
 * per machine-hour, value of one lost hour. Together the ten engine KPIs, each once, each with a yardstick.
 */
export type TileGroup = { id: 'cost' | 'next' | 'price'; title: string; figures: FigureData[] };

/** A login without money rights (v1 `mayReadMoney`: only head, plant head and admin may read money): the words only, never a figure. */
export type MoneyRefused = { refused: true; title: string; body: string };

/** The `mm` page for a login with money rights: every figure is the engine's printed text; the screen arranges it. */
export type MoneyPage = {
  refused: false;
  /** "Breakdowns cost X (hrs in days); Y could have been added." and the largest loss. */
  verdict: VerdictData;
  /** In the order cost, next, price. */
  groups: TileGroup[];
  /** ch-mm: the twelve biggest problem groups, ₹ lakh in the period; null when the engine sent no chart. */
  chart: PageChart | null;
  /** The engine's two tables in its order: the levers (name and note said apart, combined row last), then the lost table. */
  tables: PrintedTable[];
  /** ADR 0035: one line per section, ids `levers`, `chart`, `lost`. */
  takeaways?: Takeaways;
  /** "Show the rows behind Money Matters": every ticket the page priced. */
  drill?: Drill;
  /** "Source: ... Records to {date}." */
  source: string;
  words: PageWords;
};

/** Everything S22 prints. The adapter returns null when the engine has not computed the page (a money login only). */
export type MoneyMattersModel = MoneyRefused | MoneyPage;
