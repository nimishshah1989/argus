import type { ChartSeries, LineSpec } from './chart-spec.js';

/** The engine's month names: data, not copy (a month label is `Jan` inside one year and `Jan 25` across years). */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LABEL = /^([A-Z][a-z]{2}) (\d{2})$/;

/** One line of a year-over-year chart: a series' months of one year, on the axis its series was on. */
export type YearLine = ChartSeries & { year: number; source: number; current: boolean };

/**
 * A line chart over calendar months that spans more than one year, redrawn year over year (ADR 0063): one line per
 * series and year on a shared Jan–Dec axis, each named `<series> <year>`, the latest year marked `current`. Null when the
 * categories are not all `Mon YY` month labels or no month of the year comes round twice, so every other line chart draws as it did.
 */
export function yearOverYear(spec: Pick<LineSpec, 'categories' | 'series'>): {
  categories: string[];
  series: YearLine[];
} | null {
  const parsed = spec.categories.map((label) => {
    const match = LABEL.exec(label);
    const month = match ? MONTHS.indexOf(match[1]!) : -1;
    return month < 0 ? null : { month, year: 2000 + Number(match![2]) };
  });
  if (parsed.some((at) => at === null)) return null;
  // Only a span where some month comes round again compares years: a forecast's next few months stay one line.
  if (new Set(parsed.map((at) => at!.month)).size === parsed.length) return null;
  const years = [...new Set(parsed.map((at) => at!.year))].sort((a, b) => a - b);
  if (years.length < 2) return null;
  const latest = years.at(-1)!;
  const series = spec.series.flatMap((s, source) =>
    years.map((year): YearLine => {
      const values: (number | undefined)[] = Array.from({ length: 12 }, () => undefined);
      parsed.forEach((at, index) => {
        if (at!.year === year) values[at!.month] = s.values[index];
      });
      return { ...s, name: `${s.name} ${year}`, values, year, source, current: year === latest };
    }),
  );
  // A year with nothing recorded draws no line of its own (its months print as gaps in the table).
  return {
    categories: MONTHS,
    series: series.filter((line) => line.values.some((v) => v != null)),
  };
}
