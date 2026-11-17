import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { FIGURE_LABELS, drillHref, unitOf, type AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

/** A ready figure's value as a tile prints it; a computed object is not a number, so it says "Ready". */
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
  return value === null ? t('analytics.value.none') : t('analytics.value.ready');
}

/**
 * One figure on a screen: its label, its value (or the honest "Not computed yet"), and the rows behind it
 * when the engine named any. `data-figure` lets a test find the tile by its registry key.
 */
export function FigureTile({ figure, group }: { figure: Figure; group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const label = FIGURE_LABELS[figure.key] ?? 'analytics.figure.unknown';
  const ready = figure.status === 'ready';
  const unit = ready ? unitOf(figure.key) : null;
  return (
    <div
      data-figure={figure.key}
      className="flex min-w-0 flex-col gap-1 rounded-2xl bg-surface p-4 shadow-card"
    >
      <span className="text-footnote text-neutral-600">{t(label)}</span>
      <span
        className={
          ready
            ? 'text-title2 font-semibold tabular-nums'
            : 'text-body font-medium text-neutral-600'
        }
      >
        {valueText(figure, t)}
        {unit ? <span className="ml-1 text-title3 font-medium"> {t(unit)}</span> : null}
      </span>
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
