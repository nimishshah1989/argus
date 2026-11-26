import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { fill } from '../../../i18n/fill.js';
import { ChartCard } from '../../../ui/v2/chart-card.js';
import { ChartNumbers } from '../../../ui/v2/chart-numbers.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import {
  HeatMatrix,
  levelOf,
  type HeatCell,
  type HeatMatrixData,
} from '../../../ui/v2/domain/heat-matrix.js';
import { PrintedDataTable, type PrintedTable } from '../../../ui/v2/domain/printed-table.js';
import { DrillAction } from '../../../ui/v2/drill-action.js';
import { RankedBars } from '../../../ui/v2/ranked-bars.js';
import { SectionHead } from '../../../ui/v2/section-head.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { ShowDetail } from '../../../ui/v2/show-detail.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import type { PageChart } from '../printed-page/page-model.js';
import { sectionOf } from './adapter.js';
import { defaultTable } from './columns.js';
import type { MonthlyReportModel } from './model.js';

/** Five columns and five rows are the default; the rest opens in place (wireframe S23). */
const DEFAULT = 5;
const WEEK = 7;

/** The values of one series of a chart the engine drew as lines or bars; empty for any other chart. */
const valuesOf = (chart: PageChart, at: number): number[] =>
  'series' in chart.spec ? (chart.spec.series[at]?.values.map((v) => v ?? 0) ?? []) : [];

/** The month's days as a Monday-first calendar of heat cells: each day prints its number and its hours. */
function calendarOf(chart: PageChart, weekdays: string[]): HeatMatrixData | null {
  const [year, month] = (chart.id.split('|')[1] ?? '').split('-').map(Number);
  const spec = chart.spec;
  const [counts, hours] = [valuesOf(chart, 0), valuesOf(chart, 1)];
  if (!year || !month || !('series' in spec) || hours.length === 0) return null;
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % WEEK;
  const worked = hours.filter((h) => h > 0);
  const [min, max] = [Math.min(...worked), Math.max(...worked)];
  const days: HeatCell[] = hours.map((h, at) => ({
    text: `${at + 1} · ${h}`,
    level: h > 0 ? levelOf(h, min, max) : null,
    name: `${at + 1}: ${spec.series[1]?.name ?? ''} ${h}, ${spec.series[0]?.name ?? ''} ${counts[at] ?? 0}`,
  }));
  const blank: HeatCell = { text: '', level: null, name: '' };
  const cells = [...Array<HeatCell>(lead).fill(blank), ...days];
  while (cells.length % WEEK !== 0) cells.push(blank);
  return {
    id: chart.id,
    title: spec.title,
    header: { first: spec.categoryLabel, cells: weekdays, plain: [] },
    rows: Array.from({ length: cells.length / WEEK }, (_, week) => ({
      head: `${Math.max(1, week * WEEK - lead + 1)}–${Math.min(hours.length, (week + 1) * WEEK - lead)}`,
      cells: cells.slice(week * WEEK, (week + 1) * WEEK),
      plain: [],
    })),
  };
}

/** The months, worst first as ranked bars: hours as the bar, breakdowns beside it. */
function MonthBars({ chart }: { chart: PageChart }) {
  const hours = valuesOf(chart, 1);
  const counts = valuesOf(chart, 0);
  const labels = 'categories' in chart.spec ? chart.spec.categories : [];
  const rows = labels.map((label, at) => ({
    key: label,
    label,
    value: hours[at] ?? 0,
    valueText: String(hours[at] ?? 0),
    countText: String(counts[at] ?? 0),
  }));
  return (
    <section className="v2-card" aria-label={chart.spec.title}>
      <RankedBars rows={rows} label={chart.spec.title} />
    </section>
  );
}

/** One engine table: five columns and five rows to start with, and the whole table opening under it when there is more. */
function Section({
  table,
  model,
  selected,
}: {
  table: PrintedTable;
  model: MonthlyReportModel;
  selected: string | undefined;
}) {
  const { t } = useTranslation();
  const id = sectionOf(table.title, table.header[0]?.label);
  const takeaway = model.takeaways[id];
  const more = table.rows.length - DEFAULT;
  const opened = defaultTable(
    id,
    table,
    fill(t('monthly-report.againstColumn'), { month: model.previous }),
  );
  const compact: PrintedTable = { ...opened, rows: opened.rows.slice(0, DEFAULT) };
  return (
    <>
      {takeaway ? <Takeaway data={takeaway} /> : null}
      <PrintedDataTable table={compact} words={model.words.table} selected={selected} />
      {more > 0 || table.header.length > opened.header.length ? (
        <ShowDetail label={more > 0 ? fill(t('monthly-report.more'), { n: more }) : undefined}>
          <PrintedDataTable
            table={{ ...table, title: '' }}
            words={model.words.table}
            selected={selected}
          />
        </ShowDetail>
      ) : null}
    </>
  );
}

/** The short weekday names, Monday first, in the reader's language. */
const weekdaysIn = (language: string): string[] =>
  Array.from({ length: WEEK }, (_, at) =>
    new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 0, 5 + at)),
    ),
  );

/**
 * The Monthly Report on the printed-page pattern (S23): the verdict, the period and the two downloads, the day-by-day
 * chart as a calendar of heat cells and the months as ranked bars (each with its numbers), then every table the engine
 * printed worst first, each under its takeaway. The blank commentary form has none.
 */
export function MonthlyReportView({
  model,
  nav,
  title,
}: {
  model: MonthlyReportModel;
  nav: NavItem[];
  title: string;
}) {
  const { i18n, t } = useTranslation();
  const { current } = useEntityParam();
  const selected = current?.kind === 'machine' ? current.id : undefined;
  const [daily, ...rest] = model.charts;
  const calendar = daily ? calendarOf(daily, weekdaysIn(i18n.language)) : null;
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      <div className="v2-row v2-gap-6">
        <p className="v2-sub">{model.period}</p>
        {model.links.map((link) => (
          <a key={link.href} className="v2-link" href={link.href}>
            {link.label}
          </a>
        ))}
        {model.drill ? <DrillAction drill={model.drill} /> : null}
      </div>
      {daily ? (
        <>
          {model.takeaways.daily ? <Takeaway data={model.takeaways.daily} /> : null}
          <SectionHead title={daily.spec.title} sub={daily.sub} />
          {calendar ? (
            <HeatMatrix
              matrix={calendar}
              words={{ low: t('v2s.heat.low'), high: t('v2s.heat.high') }}
            />
          ) : (
            <ChartCard spec={daily.spec} sub={daily.sub} aria={daily.aria} />
          )}
          <ChartNumbers spec={daily.spec} />
        </>
      ) : null}
      {rest.map((chart) => (
        <Fragment key={chart.id}>
          {model.takeaways.months ? <Takeaway data={model.takeaways.months} /> : null}
          <SectionHead title={chart.spec.title} sub={chart.sub} />
          <MonthBars chart={chart} />
          <ChartNumbers spec={chart.spec} />
        </Fragment>
      ))}
      {model.tables.map((table, at) => (
        <Section key={`${table.title}-${at}`} table={table} model={model} selected={selected} />
      ))}
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
