import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

/** MTTR and MTBF: the engine's page as printed, plus one takeaway per table. */
export type MttrMtbfModel = PrintedPageModel & {
  /**
   * ADR 0035: `categories`, `cells`, `cell-mttr`, `cell-mtbf`, `age-mttr`, `age-mtbf`, `age-bands`, `machines`, each
   * over every row of its table (not the page shown). MTTR: high is worse; MTBF: low is worse.
   */
  takeaways?: Takeaways;
};
