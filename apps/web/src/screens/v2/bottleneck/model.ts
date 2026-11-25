import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

/** The Bottleneck page: the engine's printed page, plus its takeaways. */
export type BottleneckModel = PrintedPageModel & {
  /**
   * ADR 0035: one per engine table, `risk`, `down-log`, `down-backup`, `category`, `cell`, `forecast`, `trend-category`,
   * `trend-machine`, `repeats`; a table the engine did not send has none. The charts draw the `risk` and `forecast` rows.
   */
  takeaways?: Takeaways;
};
