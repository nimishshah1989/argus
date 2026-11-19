import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { CellPanel as Cells, type CellItem, type TagSpec } from '../../ui/elements/index.js';
import { LAST_FULL, PARTIAL, S, against, fixed, monthLong } from './data.js';
import type { Hover } from './trend-chart.js';

const PLANT = S.plant.bdPct;

/** A cell against the plant: a lower breakdown share is better, so lower is good and higher is bad. */
const againstTag = (t: TFunction, tone: ReturnType<typeof against>): TagSpec =>
  tone === 'good'
    ? { tone: 'good', word: t('tag.lowerThanPlant') }
    : tone === 'bad'
      ? { tone: 'bad', word: t('tag.higherThanPlant') }
      : { tone: 'neutral', word: t('tag.samePlant') };

/**
 * One small chart per cell: its share of available hours lost to breakdowns, month by month, against the plant's
 * (the dotted line). The big figure is the month pointed at elsewhere on the page, or the last full month; its
 * tone says whether the cell did better or worse than the plant that month, and a word says so too. The tiles are
 * the shared `CellPanel` element; this file only turns the showcase's numbers into its props.
 */
export function CellPanel({ hover }: { hover: Hover }) {
  const { t } = useTranslation('showcase');
  const month = hover.month ?? LAST_FULL;
  const plant = PLANT[month] ?? null;
  const rated = S.cells.filter((c) => c.bdPct[LAST_FULL] != null);
  const better = rated.filter((c) => c.bdPct[LAST_FULL]! < PLANT[LAST_FULL]!).length;
  const cells: CellItem[] = S.cells.map((c) => {
    const value = c.bdPct[month] ?? null;
    const tone = against(value, plant);
    return {
      id: c.cell,
      name: c.cell,
      value: value === null ? null : fixed(value, 2),
      unit: '%',
      tone: tone === 'good' || tone === 'bad' ? tone : 'neutral',
      tag: value === null ? undefined : againstTag(t, tone),
      series: c.bdPct,
      seriesLabel: t('cells.line', { cell: c.cell }),
    };
  });
  return (
    <div className="sc-card">
      <Cells
        title={t('cells.title')}
        summary={t('cells.sum', { n: better, total: rated.length, month: monthLong(LAST_FULL) })}
        note={t('cells.note')}
        cells={cells}
        reference={PLANT}
        active={hover.month}
        partial={PARTIAL}
        empty={t('cells.noRecords')}
      />
    </div>
  );
}
