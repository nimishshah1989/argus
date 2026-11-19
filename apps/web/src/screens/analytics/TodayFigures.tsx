import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { Card } from '../../ui/card.js';
import { Chart } from '../../ui/chart/chart.js';
import {
  NO_VALUE,
  KpiTile,
  RankedList,
  TrendDelta,
  type RankedItem,
} from '../../ui/elements/index.js';
import { ChevronRight } from '../../ui/icon.js';
import { figurePlaces, figureMeasure, formatFigure, splitFigure } from '../../ui/meaning/index.js';
import type { FigureContent } from './figure-content.js';
import { FigureTile } from './FigureTile.js';
import { FIGURE_LABELS, drillHref, type AnalyticsGroup } from './groups.js';
import { COMPARE_DAYS, scalarOf, type Change } from './today-change.js';

type Figure = FiguresReply['figures'][number];

/** The engine gives its figures to 2 places at most; printing 2 keeps every value exact. */
const ENGINE_DIGITS = 2;

/** A sentence is short and a timeline is wide: each takes a whole row, so no card is mostly empty space. */
const FULL_ROW: ReadonlySet<string> = new Set([
  'dashboard.breakdown-free',
  'dashboard.expansion-timeline',
]);

/** The way to the rows behind a figure; it sits at the foot of its tile or card, in the same place on each. */
function DrillLink({ figure, group }: { figure: Figure; group: AnalyticsGroup }) {
  const { t } = useTranslation();
  if (figure.drill.ids.length === 0) return null;
  return (
    <Link
      to={drillHref(group.id, figure.drill.type, figure.drill.ids)}
      className="mt-auto inline-flex min-h-target-min items-center self-start text-footnote font-semibold text-accent-text"
    >
      {t('analytics.drill.open')}
    </Link>
  );
}

/** The whole tile is the link to the rows behind it: 44 px or more, a ring on hover and on keyboard focus. */
function TileLink({ figure, group }: { figure: Figure; group: AnalyticsGroup }) {
  const { t } = useTranslation();
  if (figure.drill.ids.length === 0) return null;
  const label = t(FIGURE_LABELS[figure.key] ?? 'analytics.figure.unknown');
  return (
    <Link
      to={drillHref(group.id, figure.drill.type, figure.drill.ids)}
      aria-label={t('analytics.today.rowsFor', { figure: label })}
      className="absolute inset-0 rounded-tile hover:ring-2 hover:ring-accent-strong focus-visible:ring-2 focus-visible:ring-accent-strong"
    />
  );
}

/** One figure's cell, as tall as its row. `data-figure` lets a test find it by registry key. */
function Cell({ figure, children }: { figure: Figure; children: ReactNode }) {
  return (
    <div
      data-figure={figure.key}
      data-span={FULL_ROW.has(figure.key) ? 'full' : undefined}
      className="relative h-full min-w-0"
    >
      {children}
    </div>
  );
}

/** What a running total gained since the prior period: a quiet amount, never a verdict. */
function addedNote(change: Change | undefined, t: TFunction): string | undefined {
  if (!change?.added) return undefined;
  const sign = change.delta > 0 ? '+' : '';
  return t('analytics.today.added', {
    amount: `${sign}${formatFigure(change.measure, change.delta, ENGINE_DIGITS, figurePlaces(change.measure, change.delta))}`,
    days: COMPARE_DAYS,
  });
}

/**
 * A number tile: the exact engine value with its unit from the meaning map, its change against the prior period
 * (a verdict for a rate, a quiet amount for a running total), and a chip in words when the engine has not computed
 * it (a missing value prints a dash, never 0).
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
  const value = held ? null : scalarOf(figure);
  // The places of the engine's own value, held through the count-up so a whole count never shows decimals.
  const places = value === null ? 0 : figurePlaces(measure, value);
  return (
    <Cell figure={figure}>
      <KpiTile
        label={t(FIGURE_LABELS[figure.key] ?? 'analytics.figure.unknown')}
        value={value}
        format={(shown) => splitFigure(measure, shown, places, places).text}
        unit={value === null ? undefined : splitFigure(measure, value, places, places).unit}
        verdict={held ? t('analytics.notComputed') : undefined}
        change={change?.added ? undefined : change}
        note={addedNote(change, t)}
        action={
          figure.drill.ids.length > 0 ? (
            <ChevronRight aria-hidden size={16} className="shrink-0" />
          ) : undefined
        }
      />
      <TileLink figure={figure} group={group} />
    </Cell>
  );
}

/** Whether Today draws this figure as a number tile; a picture, a sentence or a table has its own card. */
export function isNumberFigure(figure: Figure): boolean {
  return figure.status !== 'ready' || figure.value === null || typeof figure.value === 'number';
}

/** The problems that cost the most downtime, ranked: the engine's own hours, share and count on each line. */
export function problemItems(figure: Figure, t: TFunction): RankedItem[] {
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
          share:
            typeof row.share === 'number' && Number.isFinite(row.share)
              ? `${row.share.toFixed(2)}%`
              : NO_VALUE,
          count: Number(row.breakdowns),
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
        <RankedList items={ranked} anchor />
      )}
    </>
  );
}

/** The inside of a content card: a chart (its title is the card's), a sentence or the ranked problems. */
function Inside({ figure, content }: { figure: Figure; content: FigureContent }) {
  if (content.kind === 'chart') return <Chart spec={content.spec} quietTitle />;
  if (content.kind === 'text')
    return <p className="text-title2 font-bold tabular-nums">{content.text}</p>;
  if (content.kind === 'table') return <ProblemsList figure={figure} caption={content.caption} />;
  return null;
}

const isCard = (content: FigureContent | null): content is FigureContent =>
  content !== null && ['chart', 'text', 'table'].includes(content.kind);

/** The card's title: a chart's own, so the heading is the same size as the other cards', else the figure's label. */
const titleOf = (content: FigureContent, label: string): string =>
  content.kind === 'chart' ? content.spec.title : label;

/** The change under a card's content: a verdict for a rate, a quiet amount for a running total. */
function Moved({ change }: { change: Change | undefined }) {
  const { t } = useTranslation();
  if (!change) return null;
  if (change.added) return <p className="text-footnote text-neutral-600">{addedNote(change, t)}</p>;
  return <TrendDelta measure={change.measure} delta={change.delta} />;
}

/**
 * The figures that are a picture, a sentence or a short list: each in one card with its title, the content in the
 * kit's own pieces, the change, and the way to its rows at the foot. Cards in a row are as tall as the tallest.
 * Anything the mapper cannot draw keeps the plain tile that says so honestly.
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
    <Cell figure={figure}>
      <Card fill title={titleOf(content, label)}>
        <Inside figure={figure} content={content} />
        <Moved change={change} />
        <DrillLink figure={figure} group={group} />
      </Card>
    </Cell>
  );
}
