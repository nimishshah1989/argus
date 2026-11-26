import { type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { fill } from '../../../i18n/fill.js';
import { ChartNumbers } from '../../../ui/v2/chart-numbers.js';
import { levelOf } from '../../../ui/v2/domain/heat-matrix.js';
import { type PrintedTable } from '../../../ui/v2/domain/printed-table.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { SectionHead } from '../../../ui/v2/section-head.js';
import { ShowDetail } from '../../../ui/v2/show-detail.js';
import type { PageChart } from '../printed-page/page-model.js';

/** The annual report's drawn sections (bars, the months and machines charts, the added strip), for `View.tsx`. */

const TAIL_AT = 5;

export type Bar = { key: string; label: ReactNode; value: number; text: string };

/** Bars in the order given (calendar order or costliest first), each as long as its share of the longest. */
export function Bars({ rows, label }: { rows: Bar[]; label: string }) {
  const longest = Math.max(0, ...rows.map((row) => row.value));
  return (
    <ol className="v2-ranked" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key} className="v2-ranked-row">
          <span className="v2-ranked-label">{row.label}</span>
          <span className="v2-ranked-track" aria-hidden="true">
            <span style={{ width: `${longest ? (Math.max(0, row.value) / longest) * 100 : 0}%` }} />
          </span>
          <span className="v2-ranked-text">{row.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** The values of one series of a line chart, and of a mixed chart's bars or line; empty for any other chart. */
const seriesOf = (chart: PageChart | undefined, at: number): number[] => {
  const spec = chart?.spec;
  const series =
    spec?.kind === 'line'
      ? spec.series[at]
      : spec?.kind === 'mixed'
        ? at === 0
          ? spec.bars[0]
          : spec.line
        : undefined;
  return series?.values.map((value) => value ?? 0) ?? [];
};
const labelsOf = (chart: PageChart | undefined): string[] =>
  chart && 'categories' in chart.spec ? chart.spec.categories : [];

/** The months in calendar order, hours as the bar, breakdowns beside it; the partial month starred, the worst marked. */
export function MonthsChart({ chart }: { chart: PageChart }) {
  const { t } = useTranslation();
  const [counts, hours] = [seriesOf(chart, 0), seriesOf(chart, 1)];
  const worst = hours.indexOf(Math.max(...hours));
  const rows = labelsOf(chart).map((month, at) => ({
    key: month,
    label: (
      <>
        {month.endsWith('*') ? `${month} ${t('annual-report.toDate')}` : month}{' '}
        {at === worst ? <KeyPill text={t('annual-report.worst')} tone="loss" /> : null}
      </>
    ),
    value: hours[at] ?? 0,
    text: fill(t('annual-report.monthBar'), { hours: hours[at] ?? 0, n: counts[at] ?? 0 }),
  }));
  return (
    <div data-section="months-chart">
      <SectionHead title={chart.spec.title} sub={chart.sub} />
      <section className="v2-card" aria-label={chart.spec.title}>
        <Bars rows={rows} label={chart.spec.title} />
      </section>
      <ChartNumbers spec={chart.spec} />
    </div>
  );
}

/** The five costliest machines as bars, then the rest of the fifteen opening in place with the running share of the year. */
export function MachinesChart({ chart }: { chart: PageChart }) {
  const { t } = useTranslation();
  const [hours, share] = [seriesOf(chart, 0), seriesOf(chart, 1)];
  const rows = labelsOf(chart).map((machine, at) => ({
    key: machine,
    label: (
      <>
        {machine} {at === 0 ? <KeyPill text={t('annual-report.costliest')} tone="loss" /> : null}
      </>
    ),
    value: hours[at] ?? 0,
    text: fill(t('annual-report.machineBar'), {
      hours: hours[at] ?? 0,
      share: `${share[at] ?? 0}%`,
    }),
  }));
  const tail = rows.slice(TAIL_AT);
  const together = hours.slice(TAIL_AT).reduce((sum, h) => sum + h, 0);
  return (
    <div data-section="machines-chart">
      <SectionHead title={chart.spec.title} sub={chart.sub} />
      <section className="v2-card" aria-label={chart.spec.title}>
        <Bars rows={rows.slice(0, TAIL_AT)} label={chart.spec.title} />
        {tail.length > 0 ? (
          <ShowDetail
            label={fill(t('annual-report.tail'), {
              n: tail.length,
              total: rows.length,
              hours: together.toFixed(1),
              share: `${share.at(-1) ?? 0}%`,
            })}
          >
            <Bars rows={tail} label={chart.spec.title} />
          </ShowDetail>
        ) : null}
      </section>
      <ChartNumbers spec={chart.spec} />
    </div>
  );
}

const columnOf = (table: PrintedTable, label: string): number =>
  table.header.findIndex((h) => h.label.trim().toLowerCase() === label.toLowerCase());

/** The rows with the most `label` first (the engine's tables of months and quarters print in calendar order). */
export const worstFirst = (table: PrintedTable, label: string): PrintedTable => {
  const at = columnOf(table, label);
  return at < 0
    ? table
    : { ...table, rows: [...table.rows].sort((a, b) => Number(b[at]?.sort) - Number(a[at]?.sort)) };
};

export const HOURS = 'Downtime hrs';
const PER_MACHINE = 'Hrs / machine';
const MACHINE = 'Machine';
type Row = PrintedTable['rows'][number];
const textAt = (table: PrintedTable, row: Row, label: string): string =>
  row[columnOf(table, label)]?.text ?? '';

/** Machine age: hours a machine as the bar, costliest band first, machines beside each. */
export function ageBars(table: PrintedTable, t: TFunction): Bar[] {
  return worstFirst(table, PER_MACHINE).rows.map((row, at) => ({
    key: `${row[0]?.text}-${at}`,
    label: row[0]?.text,
    value: Number(row[columnOf(table, PER_MACHINE)]?.sort),
    text: fill(t('annual-report.ageBar'), {
      hours: textAt(table, row, PER_MACHINE),
      n: textAt(table, row, 'Machines'),
    }),
  }));
}

/** PM: hours as the bar in calendar order, entries beside each; a month with no PM entry is marked. */
export function pmBars(table: PrintedTable, t: TFunction): Bar[] {
  return table.rows.map((row, at) => ({
    key: `${row[0]?.text}-${at}`,
    label: (
      <>
        {row[0]?.text}{' '}
        {textAt(table, row, 'PM entries') === '0' ? (
          <KeyPill text={t('annual-report.noPm')} tone="neutral" />
        ) : null}
      </>
    ),
    value: Number(row[columnOf(table, 'PM hours')]?.sort),
    text: fill(t('annual-report.pmBar'), {
      hours: textAt(table, row, 'PM hours'),
      n: textAt(table, row, 'PM entries'),
    }),
  }));
}

/** The longest breakdown, marked above the ranked table. */
export function LongestMark({ table }: { table: PrintedTable }) {
  const { t } = useTranslation();
  const first = table.rows[0];
  if (!first) return null;
  return (
    <p className="v2-row v2-gap-6">
      <KeyPill text={t('annual-report.longestMark')} tone="loss" />
      <span className="v2-sub">
        {fill(t('annual-report.part'), { n: 2, total: 2 })} · {textAt(table, first, MACHINE)}
      </span>
    </p>
  );
}

/** The machines added: a row per category, a cell per month tinted by how many, Added and End beside it. */
export function AddedStrip({ table }: { table: PrintedTable }) {
  const { t } = useTranslation();
  const categories = table.rows.filter((row) => row[0]?.text !== 'Total');
  const months = table.header.slice(2, -2);
  const count = (text: string | undefined): number | null => {
    const n = Number(text);
    return text && Number.isFinite(n) && n > 0 ? n : null;
  };
  const values = categories.flatMap((row) => row.slice(2, -2).flatMap((c) => count(c.text) ?? []));
  const [min, max] = [Math.min(...values), Math.max(...values)];
  return (
    <section className="v2-card" aria-label={table.title}>
      <div className="v2-heat-scroll">
        <table className="v2-heat" data-heat="matrix">
          <caption>{table.title}</caption>
          <thead>
            <tr>
              <th scope="col">{table.header[0]?.label}</th>
              {table.header.slice(2).map((h, at) => (
                <th key={`${h.label}-${at}`} scope="col">
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((row, at) => (
              <tr key={`${row[0]?.text}-${at}`}>
                <th scope="row">{row[0]?.text}</th>
                {row.slice(2).map((c, i) => {
                  const level = i < months.length ? count(c.text) : null;
                  return (
                    <td
                      key={i}
                      data-level={level === null ? undefined : levelOf(level, min, max)}
                      data-total={i < months.length ? undefined : ''}
                      title={`${row[0]?.text}, ${table.header[i + 2]?.label}`}
                    >
                      {c.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="v2-heat-legend" aria-hidden="true">
        <span>{t('v2s.heat.low')}</span>
        {([1, 2, 3, 4, 5] as const).map((level) => (
          <span key={level} className="v2-heat-step" data-level={level} />
        ))}
        <span>{t('v2s.heat.high')}</span>
      </div>
    </section>
  );
}
