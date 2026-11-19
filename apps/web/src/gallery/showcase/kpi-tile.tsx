import { useTranslation } from 'react-i18next';
import { FULL, LAST_FULL, fixed, type Metric } from './data.js';
import { Delta } from './delta.js';
import { useCountUp } from './motion.js';
import { Spark } from './spark.js';

/** The unit as it prints beside a figure: `%` and `h` stay short, a count has none. */
export const unitOf = (metric: Metric): string => metric.unit;

/**
 * One figure of the overview: what it is (label and unit), what it was against the month before, whether that is
 * good (arrow colour, with words), and its months as a line. The whole tile opens the explanation sheet.
 */
export function KpiTile({
  metric,
  active,
  onOpen,
}: {
  metric: Metric;
  active: number | null;
  onOpen: (metric: Metric) => void;
}) {
  const { t } = useTranslation('showcase');
  const shown = useCountUp(metric.headline);
  return (
    <button
      type="button"
      className="sc-tile"
      data-testid={`kpi-${metric.id}`}
      aria-haspopup="dialog"
      onClick={() => onOpen(metric)}
    >
      <span className="sc-tile-label">{t(`tile.${metric.id}`)}</span>
      <span className="sc-tile-value">
        <span className="sc-num" data-testid={`kpi-${metric.id}-value`}>
          {fixed(shown, metric.digits)}
        </span>
        {metric.unit ? <span className="sc-unit">{unitOf(metric)}</span> : null}
      </span>
      <span className="sc-tile-span">{t('tile.span')}</span>
      <Delta metric={metric} i={LAST_FULL} />
      <Spark values={metric.values.slice(0, FULL)} active={active} />
    </button>
  );
}
