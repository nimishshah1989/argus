import type { TableWords } from '../../../ui/v2/data-table.js';
import type { Drill } from '../../../ui/v2/drill.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { WhyBody, WhyFormWords } from '../../../ui/v2/domain/why-form.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** One breakdown that ran past the Why-Why limit. Every printed value is the engine's; `value` only sorts a column. */
export type WhyWhyRow = {
  id: string;
  machine: EntityChipProps;
  /** `printed` is the engine's DD-MM-YYYY, kept for the PDF's file name; `shown` is what the page prints. */
  date: { shown: string; value: number; printed: string };
  problem: string;
  down: { shown: string; value: number };
  /** The engine's own word for it ("Completed", "Not Started"), and whether a Why-Why has been saved. */
  status: { text: string; done: boolean };
  /** The ticket this row is, as the engine printed it beside the row; never shown, only sent to the server. Null when it named none. */
  ticketId: string | null;
};

export type WhyWhyWords = {
  why: string;
  /** `{n}`: the line under the page. */
  source: string;
  /** The Action column, its two buttons and the line said to a role that may not save. */
  action: { column: string; start: string; view: string; refused: string };
  form: WhyFormWords;
  table: TableWords & {
    columns: { machine: string; date: string; problem: string; down: string; status: string };
    filters: { all: string; todo: string; done: string };
  };
};

/** Everything Why-Why prints: the engine's candidate list, whole, in the reader's words, ready to print. */
export type WhyWhyModel = {
  verdict: VerdictData;
  rows: WhyWhyRow[];
  /** The rows behind the whole page's figure, as v1's link under the table. */
  drill?: Drill;
  source: string;
  words: WhyWhyWords;
};

/**
 * What a signed-in person can do on the page, from the screen that owns the writes: whether they may save, who the
 * author is, the one open form and the calls that start, save, download and close it. A page with none is read-only.
 */
export type WhyWhyActions = {
  write: boolean;
  author: string;
  /** The server's failure, in the reader's words; null when the last call went through. */
  failure: string | null;
  open: {
    rowId: string;
    machine: string;
    date: string;
    completed: boolean;
    record: WhyBody | null;
  } | null;
  saving: boolean;
  saved: boolean;
  onStart: (row: WhyWhyRow) => void;
  onSave: (body: WhyBody) => void;
  onPdf: () => void;
  onCancel: () => void;
};
