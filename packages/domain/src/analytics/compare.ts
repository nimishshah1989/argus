import {
  categoriesOf,
  categoryMttr,
  compareMachines,
  fitRates,
  historyRows,
  PARTS,
  periodOf,
  referenceOf,
  scoreOf,
  statsOf,
  type Compared,
  type Component,
  type Reference,
} from './compare-score.js';
import { formatNumber, formatPercent, metadataNumber } from './format.js';
import { machineAge } from './machine-facts.js';
import { dmy } from './plant-date.js';
import { effectiveHours, isPm, type SourcedReport } from './rows.js';
import type { Computer, FigureValue, MachineRow } from './types.js';

/**
 * Compare Machines (ticket 43, packet 43a): the whole page the 11 November key prints, with no KPI, six tables and
 * two charts. It compares two machines of one category: the category with the most machines in the plant's CNC
 * list, then the first two of that category in the pane's default order (worst age-adjusted health first). The
 * arithmetic, the age-adjusted health score and the peer column live in `compare-score.ts`; this file prints the
 * page exactly as the platform's Compare page does.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TOP = 5;
const CHART_CODES = 12;

const fixed = (value: number, decimals: number): string => formatNumber(value, decimals);
const scoreText = (value: number): string => value.toFixed(1);
const round1 = (value: number): number => Math.round(value * 10) / 10;
const one = (v: number | null): string => (v === null ? '—' : fixed(v, 1));
const two = (v: number | null): string => (v === null ? '—' : fixed(v, 2));
const whole = (v: number | null): string => (v === null ? '—' : fixed(v, 0));
const percent = (v: number | null): string => (v === null ? '—' : formatPercent(v));
const money = (v: number | null): string => `₹ ${fixed(v ?? 0, 0)}`;
const never = (): null => null;

type Check = readonly [
  label: string,
  hint: string,
  value: (s: Compared) => number | null,
  format: (v: number | null) => string,
  better: 'low' | 'high' | null,
  ref: (r: Reference) => number | null,
];
const CHECKS: readonly Check[] = [
  [
    'Health score (0–10, age-adjusted)',
    '7 = as expected for its category and age. See the scorecard above for the parts.',
    (s) => s.score,
    one,
    'high',
    never,
  ],
  ['Availability', '1 − BD hours ÷ available hours', (s) => s.a, percent, 'high', (r) => r.a],
  [
    'Breakdowns',
    'PM excluded',
    (s) => s.n,
    (v) => (v === null ? '—' : fixed(v, Number.isInteger(v) ? 0 : 1)),
    'low',
    (r) => r.n,
  ],
  ['Breakdowns per month', '', (s) => s.perMonth, one, 'low', (r) => r.perMonth],
  ['BD hours', 'NO DT entries count as 0 hours', (s) => s.h, one, 'low', (r) => r.h],
  ['BD hours per month', '', (s) => s.hPerMonth, one, 'low', (r) => r.hPerMonth],
  [
    'MTTR (hrs per breakdown)',
    'How long a repair takes on average',
    (s) => s.mttr,
    two,
    'low',
    (r) => r.mttr,
  ],
  [
    'MTBF (hrs between breakdowns)',
    'How long it runs before the next failure',
    (s) => s.mtbf,
    whole,
    'high',
    (r) => r.mtbf,
  ],
  ['Longest breakdown (hrs)', '', (s) => s.max, one, 'low', (r) => r.max],
  [
    'Days since last breakdown',
    'Counted to the last entry in the log',
    (s) => s.daysSince,
    whole,
    'high',
    never,
  ],
  ['Spares cost', 'Sum of the three spare cost fields', () => 0, money, 'low', (r) => r.cost],
  ['Spares cost per breakdown', '', () => 0, money, 'low', never],
  ['Breakdowns, last 90 days', 'To the last entry in the log', (s) => s.n90, whole, 'low', never],
  [
    'Breakdowns, the 90 days before',
    'Shows whether it is getting better or worse',
    (s) => s.p90n,
    whole,
    null,
    never,
  ],
  ['Electrical breakdowns (E)', '', (s) => s.em.E, whole, null, never],
  ['Mechanical breakdowns (M)', '', (s) => s.em.M, whole, null, never],
  [
    'PM entries logged',
    'Preventive maintenance entries in the log',
    (s) => s.pmN,
    whole,
    'high',
    never,
  ],
];

/** One machine's cell in a checkup line: the platform's tick marks the better machine when the two differ. */
function checkCell(row: Check, a: number | null, b: number | null, isA: boolean): string {
  const [, , , format, better] = row;
  const left = isA ? a : b;
  const right = isA ? b : a;
  const good =
    better !== null &&
    left !== null &&
    right !== null &&
    left !== right &&
    (better === 'low' ? left < right : left > right);
  return `${format(isA ? a : b)}${good ? ' ✓' : ''}`;
}

function checkupTable(a: Compared, b: Compared, reference: Reference) {
  const header = [
    'Parameter',
    a.machine.id,
    b.machine.id,
    reference.same ? 'Category average' : 'Plant average',
  ];
  const rows = CHECKS.map((row) => {
    const [, , value, format, , ref] = row;
    const shown = ref(reference);
    return [
      `${row[0]}${row[1]}`,
      checkCell(row, value(a), value(b), true),
      checkCell(row, value(a), value(b), false),
      shown === null ? '—' : format(shown),
    ];
  });
  return { title: 'Health checkup', header, rows, rowCount: rows.length };
}

/** The scorecard: only the parts the two machines have, with the platform's weight and detail text. */
function scorecardTable(a: Compared, b: Compared) {
  const rows = PARTS.flatMap((part) => {
    const left = a.comps.find((candidate) => candidate.key === part.key);
    const right = b.comps.find((candidate) => candidate.key === part.key);
    const shown = left ?? right;
    const cell = (component: Component | undefined): string =>
      component
        ? `${scoreText(component.score)}${component.detail}`
        : 'not scored (no spares data)';
    return shown
      ? [[`${part.label}weight ${Math.round(shown.weight * 100)}%`, cell(left), cell(right)]]
      : [];
  });
  return {
    title: 'Health scorecard (0–10, adjusted for age)',
    header: ['Part', a.machine.id, b.machine.id],
    rows,
    rowCount: rows.length,
  };
}

function footprintText(machine: MachineRow): string {
  const length = metadataNumber(machine, 'length');
  const width = metadataNumber(machine, 'width');
  return length !== null && width !== null && length > 0 && width > 0
    ? `${(length / 1000).toFixed(1)} × ${(width / 1000).toFixed(1)} m`
    : '';
}

function specificationsTable(a: Compared, b: Compared, asOf: string) {
  const specs: Array<[string, (machine: MachineRow) => string]> = [
    ['Category', (machine) => machine.category ?? ''],
    ['Make', (machine) => machine.make ?? ''],
    ['Model', (machine) => machine.model ?? ''],
    ['Controller', (machine) => machine.controller ?? ''],
    ['Control unit', (machine) => machine.controllerModel ?? ''],
    [
      'Age (years)',
      (machine) => {
        const age = machineAge(machine, asOf);
        return age === null ? '' : fixed(age, 1);
      },
    ],
    ['Year', (machine) => (machine.year === null ? '' : String(machine.year))],
    ['Power (kW)', (machine) => (machine.powerKw === null ? '' : String(machine.powerKw))],
    ['Footprint', footprintText],
    ['Cell', (machine) => machine.cell ?? ''],
    ['Location', (machine) => machine.location ?? ''],
  ];
  const cell = (machine: MachineRow, value: (m: MachineRow) => string): string =>
    value(machine) || '—';
  const rows = specs.map(([label, value]) => [
    label,
    cell(a.machine, value),
    cell(b.machine, value),
  ]);
  return {
    title: 'Specifications',
    header: ['Item', a.machine.id, b.machine.id],
    rows,
    rowCount: rows.length,
  };
}

function longestTable(stats: Compared) {
  const rows = [...stats.list]
    .sort((left, right) => effectiveHours(right.report) - effectiveHours(left.report))
    .slice(0, TOP)
    .map((row) => [
      dmy(row.report.date),
      String(row.report.problem ?? '').slice(0, 44),
      (row.report.maintCode ?? '') || '—',
      fixed(effectiveHours(row.report), 1),
    ]);
  return {
    title: `${stats.machine.id} — longest breakdowns`,
    header: ['Date', 'Problem', 'Code', 'Hrs'],
    rows,
    rowCount: rows.length,
  };
}

function shiftTable(a: Compared, b: Compared) {
  const rows = [...new Set([...Object.keys(a.shifts), ...Object.keys(b.shifts)])]
    .sort()
    .map((shift) => [
      shift,
      String((a.shifts[shift] ?? { n: 0 }).n),
      fixed((a.shifts[shift] ?? { h: 0 }).h, 1),
      String((b.shifts[shift] ?? { n: 0 }).n),
      fixed((b.shifts[shift] ?? { h: 0 }).h, 1),
    ]);
  return {
    title: 'By shift',
    header: ['Shift', `${a.machine.id} breakdowns`, 'hrs', `${b.machine.id} breakdowns`, 'hrs'],
    rows,
    rowCount: rows.length,
  };
}

function charts(a: Compared, b: Compared) {
  const union = new Map<string, { x: number; y: number }>();
  for (const code of Object.keys(a.codes)) union.set(code, { x: a.codes[code]?.h ?? 0, y: 0 });
  for (const code of Object.keys(b.codes)) {
    const entry = union.get(code) ?? { x: 0, y: 0 };
    entry.y = b.codes[code]?.h ?? 0;
    union.set(code, entry);
  }
  const total = (code: string): number => (union.get(code)?.x ?? 0) + (union.get(code)?.y ?? 0);
  const codes = [...union.keys()]
    .sort((left, right) => total(right) - total(left))
    .slice(0, CHART_CODES);
  const keys = [...new Set([...Object.keys(a.months), ...Object.keys(b.months)].map(Number))].sort(
    (left, right) => left - right,
  );
  const axes = { x: '', y: 'BD hours' };
  const tickLabels = { x: [], y: [] };
  return [
    {
      id: 'ch-cmp-code',
      type: 'bar',
      axes,
      tickLabels,
      labels: codes.map((code) => (code === '—' ? 'No code' : code)),
      datasets: [
        { label: a.machine.id, data: codes.map((code) => round1(union.get(code)?.x ?? 0)) },
        { label: b.machine.id, data: codes.map((code) => round1(union.get(code)?.y ?? 0)) },
      ],
    },
    {
      id: 'ch-cmp-month',
      type: 'line',
      axes,
      tickLabels,
      labels: keys.map((key) => `${MONTHS[key % 100]} ${String(Math.floor(key / 100)).slice(2)}`),
      datasets: [
        { label: a.machine.id, data: keys.map((key) => round1(a.months[key] ?? 0)) },
        { label: b.machine.id, data: keys.map((key) => round1(b.months[key] ?? 0)) },
      ],
    },
  ];
}

/** The Compare Machines figure. An empty plant or a category with no second machine prints no page. */
export const compareFigure: Computer = ({ data, asOf, profile }) => {
  const machines = compareMachines(data);
  const rows = historyRows(data);
  const period = periodOf(rows, data.gaps);
  if (period === null || machines.length < 2) return { value: null, drillIds: [] };
  const perDay = (profile.prodHrsPerDay * profile.workDaysPerYear) / 365;
  const breakdowns = new Map<string, SourcedReport[]>();
  const pms = new Map<string, SourcedReport[]>();
  for (const row of rows) {
    const target = isPm(row) ? pms : breakdowns;
    target.set(row.report.machineId, [...(target.get(row.report.machineId) ?? []), row]);
  }
  const stats = machines.map((machine) =>
    statsOf(machine, breakdowns.get(machine.id) ?? [], pms.get(machine.id) ?? [], {
      period,
      perDay,
    }),
  );
  const fit = stats.filter((row) => !row.machine.excludedFromProduction && row.days > 0);
  if (fit.length === 0) return { value: null, drillIds: [] };
  const fitN = fitRates(fit, 'n', 4);
  const fitH = fitRates(fit, 'h', 40);
  const context = {
    fitN,
    fitH,
    base: categoryMttr(fit),
    threshold: profile.whyWhyThresholdHours,
    end: period.end,
    noRecords: period.noRecords,
  };
  const scored = stats.map((row) => scoreOf(row, context));
  const category = categoriesOf(machines)[0]?.name;
  if (category === undefined) return { value: null, drillIds: [] };
  const pool = scored.filter((row) => row.machine.category === category);
  const ordered = [...pool].sort(
    (left, right) =>
      left.score - right.score ||
      left.machine.id.localeCompare(right.machine.id, undefined, { numeric: true }),
  );
  const a = ordered[0];
  const b = ordered[1];
  if (a === undefined || b === undefined) return { value: null, drillIds: [] };
  const reference = referenceOf(
    pool.filter((row) => !row.machine.excludedFromProduction),
    true,
  );
  const tables = [
    scorecardTable(a, b),
    checkupTable(a, b, reference),
    specificationsTable(a, b, asOf),
    longestTable(a),
    longestTable(b),
    shiftTable(a, b),
  ];
  const page = { page: 'cmp', title: 'Compare Machines', kpis: [], tables, charts: charts(a, b) };
  const value = { screen: 'compare', asOf, pages: [page] };
  return { value: value as unknown as FigureValue, drillIds: [a.machine.id, b.machine.id] };
};
