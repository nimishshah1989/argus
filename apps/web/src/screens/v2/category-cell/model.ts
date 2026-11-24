import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

/** Category and Cell: the engine's page as printed, plus one takeaway per table. */
export type CategoryCellModel = PrintedPageModel & {
  /** ADR 0035: `categories`, `cells`, `machines`, each over the BD hours of every row of its table (not the page shown). */
  takeaways?: Takeaways;
};
