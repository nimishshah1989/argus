import type { CorrectDateWords } from '../../../ui/v2/domain/correct-date.js';
import type { TableModel } from '../../../ui/v2/domain/engine-table.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** What a correction needs of one move: which machine it belongs to, and the day it stands at now (`YYYY-MM-DD`). */
export type MoveFacts = {
  id: string;
  machineId: string;
  code: string;
  day: string;
  change: string;
};

export type CellLogWords = {
  why: string;
  exportTitle: string;
  /** The controlled document's number, under the export title. */
  exportSub: string;
  export: string;
  exported: string;
  exportError: string;
  empty: string;
  /** `{machine}` and `{change}`: what is being corrected. */
  correctSub: string;
  saved: string;
  /** The figures are the saved copy (the connection is lost), and the same after a correction the server took. */
  savedCopy: string;
  savedAfterCorrection: string;
  refused: string;
  correct: CorrectDateWords;
};

/** Every recorded cell and location move, newest first, with the controlled-document export and the head's correction. */
export type CellLogModel = {
  verdict: VerdictData;
  /** ADR 0035: `moves`, over every move by the cell it went to. */
  takeaways?: Takeaways;
  kpis: KpiData[];
  table: TableModel;
  moves: MoveFacts[];
  /** Only a head or an admin may correct a move's date (the server's own rule). */
  canCorrect: boolean;
  csv: { fileName: string; text: string };
  source: string;
  words: CellLogWords;
};
