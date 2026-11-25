import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

/**
 * Manpower: the engine's page as printed, plus the words of the Specialization card's category/code toggle. The engine
 * sends only the category form; the code form says "Not computed yet", as v1's did.
 */
export type ManpowerModel = PrintedPageModel & {
  /**
   * ADR 0035: `people`, `pm-jobs`, `pm-hours`, `specialization`, `monthly-count`, `monthly-hours`, each over every row of
   * its table (not the page shown), the PLANT TOTAL row and dash cells left out.
   */
  takeaways?: Takeaways;
  specialization: {
    /** The engine's own title of the table that sits behind the toggle. */
    table: string;
    toggle: string;
    category: string;
    code: string;
    notComputed: string;
  };
};
