import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { Chart } from '../../ui/chart/chart.js';
import { contentOf, type FigureContent } from './figure-content.js';
import { PageFigure } from './PageFigure.js';
import { FIGURE_LABELS, drillHref, unitOf, type AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

/**
 * The text a tile prints when no mapper draws the value: the honest "Not computed yet", "—" for a ready figure
 * with no value, and "Only numbers so far" for an object the mapper cannot render. A number and a string keep
 * their exact face; a mapped text figure prints its sentence on this line instead.
 */
export function valueText(figure: Figure, t: TFunction): string {
  if (figure.status !== 'ready') return t('analytics.notComputed');
  const value = figure.value;
  if (typeof value === 'number') {
    const hours = unitOf(figure.key) !== null;
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: hours ? 1 : 0,
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? t('analytics.value.yes') : t('analytics.value.no');
  return value === null ? t('analytics.value.none') : t('analytics.value.onlyData');
}

/** The costliest table, in the same plain markup the chart kit prints its numbers in. */
function ContentTable({ content }: { content: Extract<FigureContent, { kind: 'table' }> }) {
  return (
    <table className="w-full text-left text-footnote">
      {content.caption === undefined ? null : (
        <caption className="pb-1 text-left text-neutral-600">{content.caption}</caption>
      )}
      <thead>
        <tr>
          {content.header.map((cell) => (
            <th key={cell} scope="col" className="p-2">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {content.rows.map((row, index) => (
          <tr key={`${index}-${row[0] ?? ''}`} className="border-t border-neutral-200">
            {row.map((cell, column) =>
              column === 0 ? (
                <th key={column} scope="row" className="p-2">
                  {cell}
                </th>
              ) : (
                <td key={column} className="p-2 tabular-nums">
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The checklist's open items: one catalogue-labelled group at a time, with its count. */
function ContentList({ content }: { content: Extract<FigureContent, { kind: 'list' }> }) {
  return (
    <div className="flex flex-col gap-2">
      {content.groups.map((group) => (
        <section key={group.label} className="flex flex-col gap-1">
          <p className="text-footnote font-semibold">
            {group.label} · {group.rows.length}
          </p>
          <ul className="flex flex-col gap-1 text-footnote text-neutral-600">
            {group.rows.map((row, index) => (
              <li key={`${group.label}-${index}`}>{row}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The sentence a mapped text figure prints, or the honest line when the value has no content. */
function tileLine(content: FigureContent | null, figure: Figure, t: TFunction): string | null {
  if (content === null) return valueText(figure, t);
  return content.kind === 'text' ? content.text : null;
}

/** The mapped content itself: a chart, a table or a grouped list, each in the kit's own markup. */
function Content({ content }: { content: FigureContent | null }) {
  if (content === null || content.kind === 'text') return null;
  if (content.kind === 'chart') return <Chart spec={content.spec} />;
  if (content.kind === 'table') return <ContentTable content={content} />;
  if (content.kind === 'page') return <PageFigure content={content} />;
  return <ContentList content={content} />;
}

/**
 * One figure on a screen: its label, its mapped content (chart, table, list or sentence), the honest line when
 * there is nothing to draw, and the rows behind it when the engine named any. `data-figure` lets a test find
 * the tile by its registry key.
 */
export function FigureTile({ figure, group }: { figure: Figure; group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const label = FIGURE_LABELS[figure.key] ?? 'analytics.figure.unknown';
  const ready = figure.status === 'ready';
  const unit = ready ? unitOf(figure.key) : null;
  const content = contentOf(figure, t);
  const line = tileLine(content, figure, t);
  const valueClass = ready
    ? 'text-title2 font-semibold tabular-nums'
    : 'text-body font-medium text-neutral-600';
  return (
    <div
      data-figure={figure.key}
      className="flex min-w-0 flex-col gap-1 rounded-2xl bg-surface p-4 shadow-card"
    >
      <span className="text-footnote text-neutral-600">{t(label)}</span>
      {line === null ? null : (
        <span className={valueClass}>
          {line}
          {unit === null ? null : <span className="ml-1 text-title3 font-medium"> {t(unit)}</span>}
        </span>
      )}
      <Content content={content} />
      {figure.drill.ids.length > 0 ? (
        <Link
          to={drillHref(group.id, figure.drill.type, figure.drill.ids)}
          className="mt-1 inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
        >
          {t('analytics.drill.open')}
        </Link>
      ) : null}
    </div>
  );
}
