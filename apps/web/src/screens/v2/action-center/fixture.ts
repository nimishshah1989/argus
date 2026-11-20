import type { DecisionData } from '../../../ui/v2/domain/decision-row.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { Point } from '../../../ui/v2/points.js';
import { dashboardFixture } from '../dashboard/fixture.js';
import { glue, pt, pts } from '../dashboard/fixture-text.js';
import type { ActionCenterModel, WatchRow } from './model.js';
import { OWNER, PEOPLE, SUGGESTED, waiting, type PersonId } from './fixture-decisions.js';
import { notWaiting } from './fixture-settled.js';
import { actionCenterWords } from './fixture-words.js';

/**
 * The Action Center's invented gallery data. Every figure is computed from the rows below: the hours and rupees a
 * month's decisions win back, the counts per owner, and each machine's score from its open nudges (a high nudge is
 * worth 3, a medium 2, a low 1). `action-center.test.ts` checks the totals add up.
 */
const hours = (d: DecisionData) => parseFloat(d.hours);
const lakh = (d: DecisionData) => parseFloat(/([\d.]+)\slakh/.exec(d.money)?.[1] ?? '0');
const sum = (ds: DecisionData[], by: (d: DecisionData) => number) =>
  ds.reduce((s, d) => s + by(d), 0);
const many = (n: number, one: string, more: string) => `${n} ${n === 1 ? one : more}`;
const h1 = (n: number) => n.toFixed(1);

const totalHours = sum(waiting, hours);
const totalLakh = sum(waiting, lakh);
const unowned = waiting.filter((d) => !OWNER[d.id]);
const unownedHours = sum(unowned, hours);
const parked = notWaiting.filter((s) => s.status === 'parked').length;
const settledNow = notWaiting.length - parked;

/** Last week, for the changes the key figures state: invented, and the only inputs that are not computed. */
const LAST_WEEK = { waiting: 5, hours: 92.3, unowned: 2, settled: 2 };

const change = (now: number, before: number, text: (n: number) => string, goodWhenUp: boolean) => ({
  text: `${now >= before ? '+' : '−'}${text(Math.abs(now - before))}`,
  up: now >= before,
  good: now >= before === goodWhenUp,
});

const kpis: KpiData[] = [
  {
    id: 'waiting',
    label: 'Decisions waiting',
    icon: 'decision',
    value: String(waiting.length),
    delta: change(waiting.length, LAST_WEEK.waiting, String, false),
    period: 'vs last week',
    meaning: 'Calls the plant is waiting on',
    more: `The biggest is worth ${glue(`${h1(hours(waiting[0]!))} h`)} a month`,
    trend: [4, 5, 5, 4, 5, LAST_WEEK.waiting, waiting.length],
  },
  {
    id: 'worth',
    label: 'Worth a month',
    icon: 'clock',
    value: glue(`${h1(totalHours)} h`),
    delta: change(totalHours, LAST_WEEK.hours, (n) => glue(`${h1(n)} h`), false),
    period: 'vs last week',
    meaning: 'Breakdown hours won back if every decision is taken',
    more: glue(`₹ ${totalLakh.toFixed(2)} lakh a year, not counting what a PM move saves`),
    trend: [84.1, 88.6, 90.2, 87.5, 91.0, LAST_WEEK.hours, totalHours],
  },
  {
    id: 'unowned',
    label: 'No owner yet',
    icon: 'person',
    value: String(unowned.length),
    delta: change(unowned.length, LAST_WEEK.unowned, String, false),
    period: 'vs last week',
    meaning: 'Decisions nobody has taken on',
    more: glue(`They are worth ${h1(unownedHours)} h a month`),
  },
  {
    id: 'settled',
    label: 'Settled this week',
    icon: 'check',
    value: String(settledNow),
    delta: change(settledNow, LAST_WEEK.settled, String, true),
    period: 'vs last week',
    meaning: 'Decisions taken in the last 7 days',
    more: `${many(parked, 'decision is', 'decisions are')} parked until a later date`,
  },
];

/** One sentence per owner, biggest first; the decisions nobody owns come last and are flagged. */
function ownerLines(): Point[] {
  const people = (Object.keys(PEOPLE) as PersonId[])
    .map((id) => ({ id, own: waiting.filter((d) => OWNER[d.id] === id) }))
    .filter((p) => p.own.length > 0)
    .sort((a, b) => sum(b.own, hours) - sum(a.own, hours));
  const lines = people.map(
    (p) =>
      `{{person:${p.id}|${PEOPLE[p.id]}}} has **${many(p.own.length, 'decision', 'decisions')}**, worth ++${h1(sum(p.own, hours))} h a month++`,
  );
  const suggested = (Object.keys(PEOPLE) as PersonId[]).flatMap((id) => {
    const n = unowned.filter((d) => SUGGESTED[d.id] === id).length;
    return n > 0
      ? [
          `{{person:${id}|${PEOPLE[id]}}} is suggested for **${many(n, 'decision', 'decisions')}**, not confirmed`,
        ]
      : [];
  });
  lines.push(...suggested);
  if (unowned.length > 0)
    lines.push(
      `!!${many(unowned.length, 'decision has', 'decisions have')} no owner!!, worth **${h1(unownedHours)} h a month**`,
    );
  return lines.map(pt);
}

const DOWN_NEXT = ['Assign a root-cause fix', 'Get the spare into stock', 'Review the last repair'];
const RISK_NEXT = ['Schedule an inspection', 'Check the last repair held', 'Move the PM earlier'];

/** Every machine that is down or at risk, with open nudges worked out from how often it stops. */
const watch: WatchRow[] = dashboardFixture.cells
  .flatMap((c) => c.machines)
  .filter((m) => m.state === 'down' || m.state === 'risk')
  .map((machine, k) => {
    const high = machine.state === 'down' ? 1 + (machine.stops > 8 ? 1 : 0) : 0;
    const medium = machine.state === 'risk' ? 2 : machine.stops % 2;
    const low = (machine.stops % 3) + 1;
    const score = high * 3 + medium * 2 + low;
    const next = (machine.state === 'down' ? DOWN_NEXT : RISK_NEXT)[k % 3]!;
    return { machine, high, medium, low, score: { shown: String(score), value: score }, next };
  })
  .sort((a, b) => b.score.value - a.score.value || a.machine.code.localeCompare(b.machine.code));

export const actionCenterFixture: ActionCenterModel = {
  verdict: {
    context: 'Friday 20-Nov-2026 · whole plant',
    headline: pt(
      `**${many(waiting.length, 'decision', 'decisions')}** ${waiting.length === 1 ? 'is' : 'are'} waiting, worth ++${h1(totalHours)} h a month++. !!${many(unowned.length, 'has', 'have')} no owner!! yet.`,
    ),
    why: pts(
      `The biggest decision, worth **${glue(`${h1(hours(waiting[0]!))} h`)}** a month, is {{decision:${waiting[0]!.id}|${waiting[0]!.title}}}`,
      `**${glue(`${h1(unownedHours)} h`)}** a month sits with decisions nobody owns`,
      `${many(settledNow, 'decision was', 'decisions were')} settled this week and ${many(parked, 'is', 'are')} parked`,
    ),
  },
  kpis,
  decisions: waiting,
  owners: ownerLines(),
  settled: notWaiting,
  watch,
  source: 'Figures as of 20-Nov-2026 09:30 IST · source: the Argus decision log and nudges',
  words: actionCenterWords(unowned.length, watch.length),
};
