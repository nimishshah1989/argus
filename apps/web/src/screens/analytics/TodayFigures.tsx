import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { Card } from '../../ui/card.js';
import { Chart } from '../../ui/chart/chart.js';
import { KpiTile, RankedList, TrendDelta, type RankedItem } from '../../ui/elements/index.js';
import { figureMeasure, formatFigure } from '../../ui/meaning/index.js';
import type { FigureContent } from './figure-content.js';
import { FigureTile } from './FigureTile.js';
import { FIGURE_LABELS, drillHref, type AnalyticsGroup } from './groups.js';
import { scalarOf, type Change } from './today-change.js';

type Figure = FiguresReply['figures'][number];

/** The engine gives its figures to 2 places at most; printing 2 keeps every value exact. */
const ENGINE_DIGITS = 2;

function DrillLink({ figure, group }: { figure: Figure; group: AnalyticsGroup }) {
  const { t } = useTranslation();
  if (figure.drill.ids.length === 0) return null;
  return (
    <Link
      to={drillHref(group.id, figure.drill.type, figure.drill.ids)}
      className="inline-flex min-h-target-min items-center self-start text-footnote font-semibold text-accent-text"
    >
      {t('analytics.drill.open')}
    </Link>
  );
}

/** One figure's cell: the figure, then the way to its rows. `data-figure` lets a test find it by registry key. */
function Cell({
  figure,
  group,
  children,
}: {
  figure: Figure;
  group: AnalyticsGroup;
  children: ReactNode;
}) {
  return (
    <div data-figure={figure.key} className="flex min-w-0 flex-col gap-1">
      {children}
      <DrillLink figure={figure} group={group} />
    </div>
  );
}

/**
 * A number tile: the exact engine value with its unit from the meaning map, its change against the prior period,
 * and a chip in words when the engine has not computed it (a missing value prints a dash, never 0).
 */
export function NumberFigure({
  figure,
  group,
  change,
}: {
  figure: Figure;
  group: AnalyticsGroup;
  change: Change | undefined;
}) {
  const { t } = useTranslation();
  const measure = figureMeasure(figure.key);
  const held = figure.status !== 'ready';
  return (
    <Cell figure={figure} group={group}>
      <KpiTile
        label={t(FIGURE_LABELS[figure.key] ?? 'analytics.figure.unknown')}
        value={held ? null : scalarOf(figure)}
        format={(value) => formatFigure(measure, value, ENGINE_DIGITS)}
        verdict={held ? t('analytics.notComputed') : undefined}
        change={change}
      />
    </Cell>
  );
}

/** Whether Today draws this figure as a number tile; a picture, a sentence or a table has its own card. */
export function isNumberFigure(figure: Figure): boolean {
  return figure.status !== 'ready' || figure.value === null || typeof figure.value === 'number';
}

function Delta({ change }: { change: Change | undefined }) {
  return change ? <TrendDelta measure={change.measure} delta={change.delta} /> : null;
}

/** The problems that cost the most downtime, ranked: the engine's own hours, share and count on each line. */
function problemItems(figure: Figure, t: ReturnType<typeof useTranslation>['t']): RankedItem[] {
  const value = figure.value as { rows?: unknown };
  const measure = figureMeasure('dashboard.costliest-problems');
  const rows = Array.isArray(value.rows) ? value.rows : [];
  return rows.flatMap((raw, at) => {
    const row = raw as {
      problem?: unknown;
      hours?: unknown;
      share?: unknown;
      breakdowns?: unknown;
    };
    const hours = Number(row.hours);
    if (!Number.isFinite(hours)) return [];
    return [
      {
        id: `${at}-${String(row.problem ?? '')}`,
        label: String(row.problem ?? ''),
        value: hours,
        display: t('analytics.today.costliest.line', {
          hours: formatFigure(measure, hours),
          share: `${Number(row.share).toFixed(2)}%`,
          count: Number(row.breakdowns).toLocaleString('en-IN'),
        }),
      },
    ];
  });
}

function ProblemsList({ figure, caption }: { figure: Figure; caption: string | undefined }) {
  const { t } = useTranslation();
  const ranked = problemItems(figure, t);
  return (
    <>
      {caption ? <p className="text-footnote text-neutral-600">{caption}</p> : null}
      {ranked.length === 0 ? (
        <p className="text-body text-neutral-600">{t('analytics.drill.empty')}</p>
      ) : (
        <RankedList items={ranked} />
      )}
    </>
  );
}

/** The inside of a content card: a chart, a sentence or the ranked problems. */
function Inside({ figure, content }: { figure: Figure; content: FigureContent }) {
  if (content.kind === 'chart') return <Chart spec={content.spec} />;
  if (content.kind === 'text')
    return <p className="text-title2 font-bold tabular-nums">{content.text}</p>;
  if (content.kind === 'table') return <ProblemsList figure={figure} caption={content.caption} />;
  return null;
}

const isCard = (content: FigureContent | null): content is FigureContent =>
  content !== null && ['chart', 'text', 'table'].includes(content.kind);

/**
 * The figures that are a picture, a sentence or a short list: each in one card with its label, the content in the
 * kit's own pieces, and the change where the figure has a prior period. Anything the mapper cannot draw keeps the
 * plain tile that says so honestly.
 */
export function ContentFigure({
  figure,
  group,
  change,
  content,
}: {
  figure: Figure;
  group: AnalyticsGroup;
  change: Change | undefined;
  content: FigureContent | null;
}) {
  const { t } = useTranslation();
  if (!isCard(content)) return <FigureTile figure={figure} group={group} />;
  const label = t(FIGURE_LABELS[figure.key] ?? 'analytics.figure.unknown');
  return (
    <Cell figure={figure} group={group}>
      <Card title={content.kind === 'chart' ? undefined : label}>
        <Inside figure={figure} content={content} />
        <Delta change={change} />
      </Card>
    </Cell>
  );
}
