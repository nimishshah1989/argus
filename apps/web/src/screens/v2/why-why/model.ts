import type { TableWords } from '../../../ui/v2/data-table.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** One breakdown that ran past the Why-Why limit. Every printed value is the engine's; `value` only sorts a column. */
export type WhyWhyRow = {
  id: string;
  machine: EntityChipProps;
  date: { shown: string; value: number };
  problem: string;
  down: { shown: string; value: number };
  /** The engine's own word for it ("Completed", "Not Started"), and whether a Why-Why has been saved. */
  status: { text: string; done: boolean };
};

export type WhyWhyWords = {
  why: string;
  /** `{n}`: the line under the page. */
  source: string;
  /** Said where Start and View used to be: the new page cannot name a row's ticket yet. */
  startNote: string;
  startLink: string;
  table: TableWords & {
    columns: { machine: string; date: string; problem: string; down: string; status: string };
    filters: { all: string; todo: string; done: string };
  };
};

/** Everything Why-Why prints: the engine's candidate list, whole, in the reader's words, ready to print. */
export type WhyWhyModel = {
  verdict: VerdictData;
  rows: WhyWhyRow[];
  source: string;
  words: WhyWhyWords;
};
