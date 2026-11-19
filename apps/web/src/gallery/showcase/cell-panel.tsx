import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { LAST_FULL, PARTIAL, S, against, fixed, monthLong } from './data.js';
import { Spark } from './spark.js';
import { Tag, type TagSpec } from './tags.js';
import type { Hover } from './trend-chart.js';

const PLANT = S.plant.bdPct;

/** A cell against the plant: a lower breakdown share is better, so lower is green and higher is red. */
const againstTag = (t: TFunction, tone: ReturnType<typeof against>): TagSpec =>
  tone === 'good'
    ? { tone: 'good', icon: 'check', word: t('tag.lowerThanPlant') }
    : tone === 'bad'
      ? { tone: 'bad', icon: 'cross', word: t('tag.higherThanPlant') }
      : { tone: 'neutral', icon: 'dash', word: t('tag.samePlant') };

/**
 * One small chart per cell: its share of available hours lost to breakdowns, month by month, against the plant's
 * (the dotted line). The big figure is the month pointed at elsewhere on the page, or the last full month; its
 * colour says whether the cell did better or worse than the plant that month, and a word says so too.
 */
export function CellPanel({ hover }: { hover: Hover }) {
  const { t } = useTranslation('showcase');
  const month = hover.month ?? LAST_FULL;
  const plant = PLANT[month] ?? null;
  const rated = S.cells.filter((c) => c.bdPct[LAST_FULL] != null);
  const better = rated.filter((c) => c.bdPct[LAST_FULL]! < PLANT[LAST_FULL]!).length;
  return (
    <section className="sc-card" aria-labelledby="sc-cells-title">
      <header className="sc-card-head">
        <div>
          <h2 id="sc-cells-title">{t('cells.title')}</h2>
          <p className="sc-sum">
            {t('cells.sum', { n: better, total: rated.length, month: monthLong(LAST_FULL) })}
          </p>
        </div>
        <p className="sc-note">{t('cells.note')}</p>
      </header>
      <ul className="sc-cells" data-testid="cell-panel">
        {S.cells.map((c) => {
          const value = c.bdPct[month] ?? null;
          const tone = against(value, plant);
          return (
            <li key={c.cell} className="sc-cell" data-tone={tone} data-family="downtime">
              <span className="sc-cell-name">{c.cell}</span>
              <span className="sc-cell-value">
                <span className="sc-num">{value === null ? '\u2014' : fixed(value, 2)}</span>
                {value === null ? null : <span className="sc-unit">%</span>}
              </span>
              <span className="sc-cell-vs">
                {value === null ? t('cells.noRecords') : <Tag tag={againstTag(t, tone)} />}
              </span>
              <Spark values={c.bdPct} reference={PLANT} active={hover.month} partial={PARTIAL} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
