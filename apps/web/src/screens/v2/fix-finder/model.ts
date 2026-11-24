import type { TableWords } from '../../../ui/v2/data-table.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { FigureData } from '../../../ui/v2/figure-tile.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** One similar past breakdown, as the engine ranked it. Every printed value is the engine's; `value` only sorts a column. */
export type FixCase = {
  id: string;
  match: { shown: string; value: number };
  date: { shown: string; value: number };
  machine: EntityChipProps;
  problem: string;
  done: string;
  down: { shown: string; value: number };
  doneBy: EntityChipProps[];
};

export type FixFinderWords = {
  why: string;
  /** `{count}` similar breakdowns, typically down `{typical}`. */
  headline: string;
  /** Said when the engine printed no count or typical downtime. */
  noFigures: string;
  /** `{date}`: when the most recent similar breakdown was. */
  lastSeen: string;
  /** `{date}`: the line under the page. */
  source: string;
  cases: TableWords & {
    columns: {
      match: string;
      date: string;
      machine: string;
      problem: string;
      done: string;
      down: string;
      doneBy: string;
    };
    filters: { all: string; full: string; partial: string };
    /** Said in a row with no one named. */
    nobody: string;
  };
};

/** Everything Fix Finder prints, in the reader's words, ready to print. */
export type FixFinderModel = {
  verdict: VerdictData;
  /** ADR 0035: `cases`, over the downtime of every case the engine printed (not the filtered rows). */
  takeaways?: Takeaways;
  figures: FigureData[];
  cases: FixCase[];
  /** Where the figures came from and how fresh they are (DD-MMM-YYYY). */
  source: string;
  words: FixFinderWords;
};
