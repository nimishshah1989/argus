import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

/** The Forecast Lab page: the engine's printed page, plus its takeaways. */
export type ForecastLabModel = PrintedPageModel & {
  /** ADR 0035: `methods` and `months`, one per engine table; the chart draws the `months` numbers. */
  takeaways?: Takeaways;
};
