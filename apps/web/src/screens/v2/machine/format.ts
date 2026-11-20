import { fill } from '../../../i18n/fill.js';
import type { Drill } from '../../../ui/v2/drill.js';
import type { Translate } from '../figures/read.js';

/** A number as the plant reads it: Indian grouping, a fixed count of places. */
export const number = (value: number, digits: number): string =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

/** What a block's rows are, so the drawer that opens them can find them: this machine's own, by part. */
export type Part = 'breakdowns' | 'pm' | 'moves' | 'machine' | 'fit' | 'spares';

/** The rows behind a block of this machine, or none when the engine named none. */
export function drillOf(
  at: { machineId: string; part: Part; ids: readonly string[] },
  figure: string,
  t: Translate,
): Drill | undefined {
  return at.ids.length === 0
    ? undefined
    : {
        figure: `machine-page:${at.machineId}:${at.part}`,
        label: fill(t('v2m.rows.open'), { figure }),
      };
}
