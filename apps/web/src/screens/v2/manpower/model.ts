import type { PrintedPageModel } from '../printed-page/page-model.js';

/**
 * Manpower: the engine's page as printed, plus the words of the Specialization card's category/code toggle. The engine
 * sends only the category form; the code form says "Not computed yet", as v1's did.
 */
export type ManpowerModel = PrintedPageModel & {
  specialization: {
    /** The engine's own title of the table that sits behind the toggle. */
    table: string;
    toggle: string;
    category: string;
    code: string;
    notComputed: string;
  };
};
