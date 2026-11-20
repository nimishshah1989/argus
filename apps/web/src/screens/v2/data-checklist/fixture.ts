import type { CheckData } from '../../../ui/v2/domain/check-row.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import { PEOPLE } from '../action-center/fixture-decisions.js';
import { pt, pts } from '../dashboard/fixture-text.js';
import type { CheckGroup, DataChecklistModel, RecordRow } from './model.js';
import {
  AREAS,
  CHECKS,
  daysAgo,
  person,
  recordsOf,
  type Area,
  type Check,
} from './fixture-checks.js';
import { dataChecklistWords } from './fixture-words.js';

/**
 * The Data Checklist's invented gallery data. Every figure is worked out from the twelve checks and the records
 * behind them: how many pass, which gaps change a figure, how many records are left to fix, how old the oldest gap is.
 * `data-checklist.test.ts` checks the totals add up.
 */
const many = (n: number, one: string, more: string) => `${n} ${n === 1 ? one : more}`;
const failing = CHECKS.filter((c) => c.status !== 'ready');
const gaps = failing.filter((c) => c.status === 'gap');
const records: RecordRow[] = failing.flatMap(recordsOf).sort((a, b) => b.open.value - a.open.value);
const passing = CHECKS.filter((c) => c.status === 'ready');
const percent = Math.round((passing.length / CHECKS.length) * 100);
const oldest = Math.max(...gaps.flatMap((c) => c.ages));
const oldestRecord = records.find(
  (r) => r.open.value === oldest && gaps.some((g) => r.id.startsWith(`${g.id}-`)),
)!;
const recordCount = (c: Check) => c.machines.length;

/** Last week, for the changes the key figures state: invented, and the only inputs that are not computed. */
const LAST_WEEK = { percent: 50, gaps: 4, records: 30, oldest: 30 };

const change = (now: number, before: number, text: (n: number) => string, goodWhenUp: boolean) => ({
  text: `${now >= before ? '+' : '−'}${text(Math.abs(now - before))}`,
  up: now >= before,
  good: now >= before === goodWhenUp,
});

const kpis: KpiData[] = [
  {
    id: 'passing',
    label: 'Checks passing',
    icon: 'check',
    value: `${percent}%`,
    delta: change(percent, LAST_WEEK.percent, (n) => `${n} pts`, true),
    period: 'vs last week',
    meaning: `${passing.length} of ${CHECKS.length} data checks pass`,
    more: `${many(gaps.length, 'gap changes', 'gaps change')} a figure you see today`,
    trend: [42, 42, 50, 50, 50, LAST_WEEK.percent, percent],
  },
  {
    id: 'gaps',
    label: 'Gaps changing figures',
    icon: 'alert',
    value: String(gaps.length),
    delta: change(gaps.length, LAST_WEEK.gaps, String, false),
    period: 'vs last week',
    meaning: 'Gaps that change a figure on your screens',
    more: gaps.map((g) => g.impact.replace('Changes ', '')).join(', '),
    trend: [5, 5, 4, 4, 4, LAST_WEEK.gaps, gaps.length],
  },
  {
    id: 'records',
    label: 'Records to fix',
    icon: 'list',
    value: String(records.length),
    delta: change(records.length, LAST_WEEK.records, String, false),
    period: 'vs last week',
    meaning: 'Rows behind the gaps and the checks',
    more: `${recordCount(gaps.find((g) => g.id === 'b1')!)} are breakdowns without a problem code`,
  },
  {
    id: 'oldest',
    label: 'Oldest gap',
    icon: 'clock',
    value: `${oldest} days`,
    delta: change(oldest, LAST_WEEK.oldest, (n) => `${n} days`, false),
    period: 'vs last week',
    meaning: 'How long the longest-open gap has waited',
    more: `Open since ${daysAgo(oldest)}`,
  },
];

const checkRow = (c: Check): CheckData => {
  const n = recordCount(c);
  const shown = c.machines.slice(0, 4).map((m) => `{{machine:${m.code}|${m.code}}}`);
  const rest = n - shown.length;
  return {
    id: c.id,
    status: c.status === 'gap' ? 'gap' : 'check',
    statusLabel: c.status === 'gap' ? 'Gap' : 'Check',
    title: c.title,
    state: pt(`${shown.join(', ')}${rest > 0 ? ` and ${rest} more` : ''}`),
    impact: c.impact,
    records: String(n),
    recordsNote: n === 1 ? 'record to fix' : 'records to fix',
    owner: person(AREAS[c.area].owner),
    why: pts(...c.why),
    fix: c.fix,
    doneText: `Sent to ${PEOPLE[AREAS[c.area].owner]}`,
    done: false,
  };
};

/** Each part of the data that has something to fix, the one with the most gaps first. */
function groups(): CheckGroup[] {
  const count = (a: Area, status: Check['status']) =>
    failing.filter((c) => c.area === a && c.status === status).length;
  const areas = ([...new Set(failing.map((c) => c.area))] as Area[]).sort(
    (a, b) => count(b, 'gap') - count(a, 'gap'),
  );
  const part = (a: Area, status: Check['status'], one: string, more: string) =>
    count(a, status) ? many(count(a, status), one, more) : '';
  return areas.map((a) => ({
    id: a,
    name: AREAS[a].label,
    summary: [part(a, 'gap', 'gap', 'gaps'), part(a, 'check', 'check', 'checks')]
      .filter(Boolean)
      .join(' · '),
    owner: person(AREAS[a].owner),
    checks: failing.filter((c) => c.area === a).map(checkRow),
  }));
}

const heaviest = (Object.keys(AREAS) as Area[])
  .map((a) => ({ owner: AREAS[a].owner, n: records.filter((r) => r.area.key === a).length }))
  .sort((a, b) => b.n - a.n)[0]!;

export const dataChecklistFixture: DataChecklistModel = {
  verdict: {
    context: 'Friday 20-Nov-2026 · whole plant',
    headline: pt(
      `**${passing.length} of ${CHECKS.length}** data checks pass. !!${many(gaps.length, 'gap', 'gaps')}!! change figures you see today.`,
    ),
    why: pts(
      `The gaps change: ${gaps.map((g) => `~~${g.impact.replace('Changes ', '')}~~`).join(', ')}`,
      `{{person:${heaviest.owner}|${PEOPLE[heaviest.owner]}}} has the most to fix: **${many(heaviest.n, 'record', 'records')}**`,
      `The oldest gap has been open **${oldest} days**, on {{machine:${oldestRecord.entity.id}|${oldestRecord.entity.label}}}`,
    ),
  },
  kpis,
  groups: groups(),
  records,
  passing: passing.map((c) => pt(c.passes!)),
  source:
    'Figures as of 20-Nov-2026 09:30 IST · source: the Argus breakdown log and machine records',
  words: dataChecklistWords(records.length, passing.length),
};
