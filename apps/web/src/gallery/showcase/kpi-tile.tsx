import { useTranslation } from 'react-i18next';
import { KpiTile as Tile } from '../../ui/elements/index.js';
import { LAST_FULL, PARTIAL, fixed, type Metric } from './data.js';
import { Delta } from './delta.js';
import { FAMILY } from './families.js';
import { monthTags } from './tags.js';

/**
 * One figure of the overview: what it is (label and unit), what it was against the month before, whether that is
 * good (arrow colour, with words), and its months as a line. The whole tile opens the explanation sheet. The tile is
 * the shared `KpiTile` element; this file only turns the showcase's numbers into its props.
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
  return (
    <Tile
      label={t(`tile.${metric.id}`)}
      value={metric.headline}
      format={(n) => fixed(n, metric.digits)}
      unit={metric.unit || undefined}
      family={FAMILY[metric.id]}
      note={t('tile.span')}
      tags={monthTags(t, metric, LAST_FULL)}
      detail={<Delta metric={metric} i={LAST_FULL} />}
      trend={{
        values: metric.values,
        label: t('tile.line', { metric: t(`tile.${metric.id}`) }),
        partial: PARTIAL,
        active,
        wide: true,
      }}
      testId={`kpi-${metric.id}`}
      valueTestId={`kpi-${metric.id}-value`}
      onOpen={() => onOpen(metric)}
    />
  );
}
