import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { TrendData } from '../../../ui/v2/trend-chart.js';
import { MONTH_HOURS } from './fixture-plant.js';
import { glue } from './fixture-text.js';

/** The last 12 months, December to November: invented, ending on this month's 312.4 h and October's 286.0 h. */
const MONTHS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
export const BREAKDOWN = [
  268.2,
  274.5,
  259.8,
  281.3,
  290.6,
  276.4,
  270.1,
  288.9,
  279.5,
  301.7,
  286.0,
  MONTH_HOURS,
];
const PM = [96.0, 102.0, 99.0, 105.0, 108.0, 101.0, 99.0, 110.0, 104.0, 107.0, 112.0, 109.0];
const AVAILABILITY = [
  99.21, 99.25, 99.3, 99.2, 99.18, 99.27, 99.31, 99.22, 99.26, 99.12, 99.18, 99.36,
];
const MTTR = [4.3, 4.1, 4.2, 4.0, 3.9, 4.1, 4.2, 3.8, 3.9, 4.1, 4.0, 3.6];
/** The plant's rate, ₹ an hour of breakdown; lakh = hours × rate / 1,00,000. */
const RATE = 3329;

export const KPIS: KpiData[] = [
  {
    id: 'hours',
    label: 'Breakdown hours',
    icon: 'clock',
    value: glue('312.4 h'),
    delta: { text: glue('+26.4 h'), up: true, good: false },
    period: 'vs Oct',
    meaning: 'Machine time lost to breakdowns this month',
    more: '3 machines caused 31% · Cell 8 rose most, +14.0 h',
    trend: BREAKDOWN,
  },
  {
    id: 'lost',
    label: 'Lost this month',
    icon: 'rupee',
    value: glue('₹ 10.4 lakh'),
    delta: { text: '+9.2%', up: true, good: false },
    period: 'vs Oct',
    meaning: 'Production value lost to those hours',
    more: glue('At ₹ 3,329 an hour · 4 decisions win back ₹ 1.30 lakh a month'),
    trend: BREAKDOWN.map((h) => Math.round((h * RATE) / 1000) / 100),
  },
  {
    id: 'availability',
    label: 'Fleet availability',
    icon: 'gauge',
    value: '99.36%',
    delta: { text: glue('+0.18 pts'), up: true, good: true },
    period: 'vs Oct',
    meaning: 'Share of planned machine time available',
    more: glue('Target 99.5% · 42 machine-hours short'),
    trend: AVAILABILITY,
  },
  {
    id: 'mttr',
    label: 'Time to repair',
    icon: 'wrench',
    value: glue('3.6 h'),
    delta: { text: glue('−0.4 h'), up: false, good: true },
    period: 'vs Oct',
    meaning: 'Average from a stop to running again',
    more: 'Slowest: waiting for spares on 9 jobs',
    trend: MTTR,
  },
];

export const TREND: TrendData = {
  title: 'Breakdown and PM hours',
  sub: '12 months · hover any month for its exact hours',
  aria: 'Breakdown hours by month, December to November, rising to 312.4 h in November; PM hours steady near 105 h',
  categoryLabel: 'Month',
  valueLabel: 'Hours',
  categories: MONTHS,
  series: [
    { name: 'Breakdown', values: BREAKDOWN, tone: 'danger' },
    { name: 'PM', values: PM, tone: 'info' },
  ],
};
