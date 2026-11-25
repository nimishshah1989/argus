import i18n from '../../../i18n/index.js';
import { machineChip } from '../../../ui/v2/domain/plant.js';
import type { Item } from '../insight.js';
import { dashboardFixture } from '../dashboard/fixture.js';
import { byLoss, differences, kpis, trend, verdict } from './fixture-build.js';
import { COMPARABLE, yearOf } from './fixture-rows.js';
import { figures, statsOf, weekly, type Stats } from './fixture-stats.js';
import type { CompareModel, CompareParams } from './model.js';
import { compareTakeaways } from './adapter.js';

/**
 * Compare's invented gallery data: any two of five vertical machining centres of the Dashboard's plant, asked for by
 * code. Each one's year is a list of breakdowns; every figure printed is added up from them (fixture tests check).
 */
const machines = new Map(dashboardFixture.cells.flatMap((c) => c.machines).map((m) => [m.code, m]));

const stats = (code: string): Stats | null => {
  const [m, y] = [machines.get(code), yearOf(code)];
  return m && y ? statsOf(m, y) : null;
};
const sub = (s: Stats) => `${s.machine.typeLabel} · ${s.year.age} years old`;
const item = (name: string, value: number): Item => ({
  name,
  value,
  shown: `${value.toFixed(1)} h`,
});
const t = (key: string, values?: Record<string, unknown>) => i18n.t(key, { ...values }) as string;

/** The takeaways (ticket 674) over the same figures the gallery prints: each cause's hours, and each machine's 12 weeks. */
const takeawaysOf = (worse: Stats, sa: Stats, sb: Stats) =>
  compareTakeaways(
    {
      causes: [...worse.causes].map(([name, c]) => item(name, c.tenths / 10)),
      series: [sa, sb].map((s) =>
        item(
          s.machine.code,
          weekly(s).reduce((x, v) => x + v, 0),
        ),
      ),
    },
    t,
  );

/** The comparison of two machines, or nothing when they are the same one or the plant does not know one. */
export function compareFixture({ a, b }: CompareParams): CompareModel | null {
  const [sa, sb] = [stats(a), stats(b)];
  if (!sa || !sb || a === b) return null;
  const [worse, better] = byLoss(sa, sb);
  const [fa, fb] = figures(sa, sb);
  return {
    verdict: verdict(worse, better),
    takeaways: takeawaysOf(worse, sa, sb),
    pick: { a, b, options: COMPARABLE.map((key) => ({ key, label: key })) },
    kpis: kpis(worse, better),
    boxes: [
      { chip: machineChip(sa.machine), sub: sub(sa), figures: fa },
      { chip: machineChip(sb.machine), sub: sub(sb), figures: fb },
    ],
    differences: {
      title: 'What is different',
      points: differences(worse, better),
      action: 'Add the fix to Team Focus',
      doneText: 'Added to Team Focus',
      done: false,
    },
    trend: trend(sa, sb),
    source: 'Figures as of 20-Nov-2026 09:30 IST · source: the Argus breakdown log',
    words: { why: 'Why?', pickA: 'First machine', pickB: 'Second machine' },
  };
}

export const DEFAULT_PAIR: CompareParams = { a: 'VC-67', b: 'VC-18' };
