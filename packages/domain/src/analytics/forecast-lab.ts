import { a9RiskCore } from './a9-bottleneck.js';
import { fleetRows } from './a9-forecast-sim.js';
import {
  actualOf,
  baseOf,
  monthsOf,
  ratesOf,
  runMonth,
  scoreMonth,
  summarize,
  type LabMonth,
  type MethodKey,
  type Scores,
  type Summary,
} from './forecast-lab-sim.js';
import { formatNumber } from './format.js';
import { dayNumber } from './plant-date.js';
import type { SourcedReport } from './rows.js';
import type { Computer, FigureValue } from './types.js';

/**
 * The Forecast Lab's page (ticket 42, packet 42d): the four methods' table, the month detail and the ch-fl chart,
 * whole against the frozen 11 November key. The backtest itself — months, rates, simulation and scores — is
 * `forecast-lab-sim.ts`; this file owns the key's words, the Adopt rule and the figure.
 */

const SCREEN = 'forecast-lab';

interface Table {
  title: string;
  header: string[];
  rows: string[][];
  rowCount: number;
}

type Page = {
  page: string;
  title: string;
  kpis: unknown[];
  tables: Table[];
  charts: unknown[];
};

type Method = { key: MethodKey; name: string; description: string };

const METHODS: readonly Method[] = [
  {
    key: 'M0',
    name: 'Current model',
    description:
      'Each machine’s own breakdown rate, pulled towards the average of other machines in its category.',
  },
  {
    key: 'M1',
    name: 'Age-adjusted',
    description:
      'Same, but the starting point also allows for the machine’s age band (new and old machines fail at different rates).',
  },
  {
    key: 'M2',
    name: 'Recent-weighted',
    description:
      'Same as current, but recent breakdowns count more than old ones (older events fade with a half-life).',
  },
  {
    key: 'M3',
    name: 'Age + recent',
    description: 'Both changes together.',
  },
];

interface Comparison {
  dLoss: number;
  dRange: number;
  verdict: string;
  why: string;
}

interface MethodResult {
  method: Method;
  summary: Summary;
  comparison: Comparison;
  better: number;
}

const BASELINE: Comparison = {
  dLoss: 0,
  dRange: 0,
  verdict: 'Baseline',
  why: 'The model used today.',
};

const SUMMARY_HEADER = [
  'Method',
  'Accuracy score (lower is better)',
  'Change vs current',
  'Above 80% line (about 20% is right)',
  'Above 90% line (about 10% is right)',
  'Plant inside 80% range',
  'Top-10 caught',
  'Better than current',
  'Verdict',
  '',
];
const DETAIL_TITLE =
  'Month detail (median forecast, with the 80% range in brackets; red = actual fell outside)';

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

const round1 = (value: number): number => Math.round(value * 10) / 10;

const table = (title: string, header: string[], rows: string[][]): Table => ({
  title,
  header,
  rows,
  rowCount: rows.length,
});

/** The Adopt rule and the key's own words: accuracy, range reliability, and a win in more than half. */
function comparisonOf(
  summary: Summary,
  baseline: Summary,
  better: number,
  months: number,
): Comparison {
  const dLoss = baseline.loss > 0 ? (summary.loss - baseline.loss) / baseline.loss : 0;
  const dRange = summary.range - baseline.range;
  const accuracy = dLoss <= -0.01;
  const ranges = dRange <= 0.01;
  const wins = better > months / 2;
  const adopt = accuracy && ranges && wins;
  const why = adopt
    ? `Accuracy improved ${formatNumber(-dLoss * 100, 1)}%, the ranges are no less reliable, and it was better in ${better} of ${months} months.`
    : [
        !accuracy
          ? dLoss < 0
            ? `Accuracy gain (${formatNumber(-dLoss * 100, 1)}%) is under the 1% needed`
            : `Accuracy is ${formatNumber(dLoss * 100, 1)}% worse`
          : '',
        !ranges ? 'the 80% and 90% ranges become less reliable' : '',
        !wins ? `better in only ${better} of ${months} months` : '',
      ]
        .filter((part) => part !== '')
        .join('; ') + '.';
  return { dLoss, dRange, verdict: adopt ? 'Adopt' : 'Do not adopt', why };
}

/** Table 0: one row per method, the numbers and the verdict the key prints. */
function summaryTable(results: readonly MethodResult[], months: number): Table {
  const rows = results.map(({ method, summary, comparison, better }) => [
    `${method.name}${method.key === 'M0' ? ' in use' : ''}${method.description}`,
    formatNumber(summary.loss, 2),
    method.key === 'M0'
      ? '—'
      : `${comparison.dLoss <= 0 ? '' : '+'}${formatNumber(comparison.dLoss * 100, 1)}%`,
    `${formatNumber(summary.ex80 * 100, 1)}%`,
    `${formatNumber(summary.ex90 * 100, 1)}%`,
    `${summary.inBand} of ${months}`,
    summary.cap === null ? '—' : `${formatNumber(summary.cap * 100, 1)}%`,
    method.key === 'M0' ? '—' : `${better} of ${months}`,
    `${comparison.verdict}${comparison.why}`,
    method.key === 'M0' ? '' : 'Use for Planning',
  ]);
  return table('How each method did', SUMMARY_HEADER, rows);
}

/** Table 1: the month's actual hours and each method's median with its 10–90 range, 0 dp. */
function detailTable(
  months: readonly LabMonth[],
  actuals: readonly number[],
  scores: Scores,
): Table {
  const header = ['Month', 'Actual hrs', ...METHODS.map((method) => method.name)];
  const rows = months.map((month, index) => [
    month.label,
    formatNumber(actuals[index] ?? 0, 1),
    ...METHODS.map((method) => {
      const score = scores[method.key][index];
      return score === undefined
        ? '—'
        : `${formatNumber(score.median, 0)} (${formatNumber(score.low, 0)}–${formatNumber(score.high, 0)})`;
    }),
  ]);
  return table(DETAIL_TITLE, header, rows);
}

/** The ch-fl line chart: actual hours and each method's median, to one decimal. */
function chartOf(months: readonly LabMonth[], actuals: readonly number[], scores: Scores): unknown {
  const labels = months.map((month) => month.label);
  return {
    id: 'ch-fl',
    type: 'line',
    axes: { x: '', y: 'Breakdown hours in the month' },
    tickLabels: { x: [], y: [] },
    labels,
    datasets: [
      { label: 'Actual', data: actuals.map(round1) },
      ...METHODS.map((method) => ({
        label: method.name,
        data: scores[method.key].map((score) => round1(score.median)),
      })),
    ],
  };
}

/** The page: the four-method backtest over the tested months, every method sharing the same seeds. */
function labPage(
  core: Parameters<typeof baseOf>[0],
  rows: readonly SourcedReport[],
  halfLife: number,
): Page {
  const periodStart = dayNumber(core.from) ?? 0;
  const gaps = core.noRecords ?? [];
  const months = monthsOf(core.from, dayNumber(core.to) ?? 0).filter(
    (month) => !gaps.includes(new Date(month.start * 86_400_000).toISOString().slice(0, 7)),
  );
  const actuals: number[] = [];
  const scores: Scores = { M0: [], M1: [], M2: [], M3: [] };
  for (const month of months) {
    const cut = month.start - 1;
    const base = baseOf(core, rows, cut, periodStart);
    const actual = actualOf(rows, base, month);
    actuals.push(sum(base.map((machine) => actual.get(machine.machine.id) ?? 0)));
    for (const method of METHODS) {
      const lam = ratesOf(base, cut, method.key, halfLife);
      scores[method.key].push(scoreMonth(runMonth(base, lam, month.days), actual));
    }
  }
  const summaries = METHODS.map((method) => summarize(scores[method.key]));
  const baseline = summaries[0]!;
  const results = METHODS.map((method, index): MethodResult => {
    const summary = summaries[index]!;
    if (method.key === 'M0') return { method, summary, comparison: BASELINE, better: 0 };
    const better = scores[method.key].filter(
      (score, monthIndex) => score.loss < (scores.M0[monthIndex]?.loss ?? 0),
    ).length;
    return {
      method,
      summary,
      comparison: comparisonOf(summary, baseline, better, months.length),
      better,
    };
  });
  const tables =
    months.length === 0
      ? []
      : [summaryTable(results, months.length), detailTable(months, actuals, scores)];
  const charts = months.length === 0 ? [] : [chartOf(months, actuals, scores)];
  return { page: 'fl', title: 'Forecast Lab', kpis: [], tables, charts };
}

/**
 * The Forecast Lab figure: the four methods backtested on the months the plant has already lived, whole against
 * the key, a month the plant recorded nothing in left untested (a gap in the log is not a month without a failure).
 * The drill is every production machine; a plant with no production breakdown prints no page.
 */
export const forecastLabFigure: Computer = ({ data, asOf, profile }) => {
  const core = a9RiskCore(data, profile);
  if (core === null) return { value: null, drillIds: [] };
  const page = labPage(core, fleetRows(data), profile.flHalfLife);
  const value = { screen: SCREEN, asOf, pages: [page] };
  return {
    value: value as unknown as FigureValue,
    drillIds: core.fleet.map((risk) => risk.machine.id),
  };
};
