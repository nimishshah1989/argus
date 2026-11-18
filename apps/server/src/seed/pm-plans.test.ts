import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PM_MEASUREMENT_LABELS, mapPmPlans } from './pm-plans.js';

interface PlanRow {
  id: string;
  machineId: string;
  date: string;
  source: string;
  done?: string;
}

interface ReportRow {
  machineId: string;
  total: number;
  undone: number[];
  meas: Record<string, string>;
}

interface Fixture {
  pmPlan: PlanRow[];
  pmReports: ReportRow[];
  settings: { pmFreq: number; pmMach?: Record<string, { f: string; d?: number }> };
}

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')) as T;
const fixture = readJson<Fixture>('../../../../fixtures/answer-key/input.json');
const AS_OF = '2026-11-11';
const mapped = mapPmPlans(fixture, { asOf: AS_OF });

const days = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The workbook's next projected visit per machine: the earliest date after the as-of. */
function nextSourceDates(): Map<string, string> {
  const next = new Map<string, string>();
  for (const row of fixture.pmPlan) {
    if (row.date <= AS_OF) continue;
    const old = next.get(row.machineId);
    if (!old || row.date < old) next.set(row.machineId, row.date);
  }
  return next;
}

describe('the workbook PM Plan mapper', () => {
  it('accounts for all 427 source rows as 125 machine plans', () => {
    expect(mapped.sourceRows).toBe(427);
    expect(Object.values(mapped.visits).reduce((sum, n) => sum + n, 0)).toBe(427);
    expect(mapped.visits).toEqual({ plan: 169, rule: 58, manual: 38, auto: 162 });
    expect(mapped.plans).toHaveLength(125);
    expect(new Set(mapped.plans.map((plan) => plan.machineId)).size).toBe(125);
    expect(mapped.plans.filter((plan) => plan.lastDoneOn !== null)).toHaveLength(15);
    expect(mapped.plans.filter((plan) => plan.checklist.length > 0)).toHaveLength(2);
    expect(mapped.reports).toHaveLength(2);
  });

  it('imports the two reports as numbered tick items and measured readings', () => {
    const tc = mapped.plans.find((plan) => plan.machineId === 'TC-31');
    const vc = mapped.plans.find((plan) => plan.machineId === 'VC-6');
    if (!tc || !vc) throw new Error('the two reported machines are missing');
    expect(tc.checklist).toHaveLength(32);
    expect(tc.checklist.filter((item) => item.kind === 'tick')).toHaveLength(26);
    expect(tc.checklist.filter((item) => item.kind === 'reading')).toHaveLength(6);
    expect(vc.checklist).toHaveLength(47);
    expect(vc.checklist.filter((item) => item.kind === 'tick')).toHaveLength(38);
    expect(vc.checklist.filter((item) => item.kind === 'reading')).toHaveLength(9);

    expect(tc.checklist[0]).toEqual({ id: '1', kind: 'tick', point: 1 });
    expect(tc.checklist.at(-1)).toEqual({
      id: '29.tc',
      kind: 'reading',
      point: 29,
      metric: 'tc',
      label: 'Tail stock centre',
      unit: 'mm',
    });
    const readings = tc.checklist.filter((item) => item.kind === 'reading');
    expect(readings.map((item) => item.id)).toEqual([
      '27.bx',
      '27.bz',
      '28.tx',
      '28.tz',
      '29.sr',
      '29.tc',
    ]);
    expect(PM_MEASUREMENT_LABELS.bx).toBe('Backlash X');
    expect(PM_MEASUREMENT_LABELS.txz).toBe('Taper XZ');

    for (const plan of mapped.plans) {
      if (plan.machineId !== 'TC-31' && plan.machineId !== 'VC-6')
        expect(plan.checklist).toEqual([]);
    }
  });

  it('keeps every machine’s next date: exact for the 110 never-done plans, re-derived for the 15 done', () => {
    const next = nextSourceDates();
    const differences: Array<{ machineId: string; days: number }> = [];
    for (const plan of mapped.plans) {
      const source = next.get(plan.machineId);
      if (!source) throw new Error(`${plan.machineId} has no next planned date`);
      const due = addDays(plan.lastDoneOn ?? plan.anchorOn, plan.intervalDays);
      differences.push({ machineId: plan.machineId, days: days(source, due) });
    }
    expect(differences.filter((row) => row.days === 0)).toHaveLength(110);
    expect(differences.filter((row) => row.days < 0)).toHaveLength(14);
    expect(differences.filter((row) => row.days > 0)).toHaveLength(1);
    expect(differences.find((row) => row.machineId === 'VC-6')?.days).toBe(14);
    for (const row of differences.filter((row) => row.days < 0))
      expect(Math.abs(row.days), row.machineId).toBeGreaterThanOrEqual(1);
    for (const row of differences.filter((row) => row.days < 0))
      expect(Math.abs(row.days), row.machineId).toBeLessThanOrEqual(10);
  });

  it('anchors each plan on its last done date, else the next date less one interval, which may be future', () => {
    const next = nextSourceDates();
    for (const plan of mapped.plans) {
      expect(plan.intervalDays).toBe(182);
      expect(plan.title).toBe(`${plan.machineId} preventive maintenance`);
      if (plan.lastDoneOn) {
        expect(plan.anchorOn, plan.machineId).toBe(plan.lastDoneOn);
      } else {
        expect(plan.anchorOn, plan.machineId).toBe(
          addDays(next.get(plan.machineId)!, -plan.intervalDays),
        );
      }
    }
    const vc = mapped.plans.find((plan) => plan.machineId === 'VC-6');
    expect(vc?.lastDoneOn).toBe('2026-10-19');
    expect(mapped.plans.some((plan) => plan.anchorOn > AS_OF)).toBe(true);
  });

  it('carries the measured readings as the platform names them, with the report’s counts', () => {
    const tc = mapped.reports.find((report) => report.machineId === 'TC-31');
    const vc = mapped.reports.find((report) => report.machineId === 'VC-6');
    expect(tc).toEqual({ machineId: 'TC-31', total: 26, tick: 26, readings: 6 });
    expect(vc).toEqual({ machineId: 'VC-6', total: 38, tick: 38, readings: 9 });
  });

  it('reads a machine’s own frequency when the settings carry one', () => {
    const custom = mapPmPlans(
      { ...fixture, settings: { ...fixture.settings, pmMach: { 'TC-3': { f: 'custom', d: 30 } } } },
      { asOf: AS_OF },
    );
    expect(custom.plans.find((plan) => plan.machineId === 'TC-3')?.intervalDays).toBe(30);
    const weekly = mapPmPlans(
      { ...fixture, settings: { ...fixture.settings, pmMach: { 'TC-3': { f: '1w' } } } },
      { asOf: AS_OF },
    );
    expect(weekly.plans.find((plan) => plan.machineId === 'TC-3')?.intervalDays).toBe(7);
    const quarterly = mapPmPlans(
      { ...fixture, settings: { ...fixture.settings, pmMach: { 'TC-3': { f: '3m' } } } },
      { asOf: AS_OF },
    );
    expect(quarterly.plans.find((plan) => plan.machineId === 'TC-3')?.intervalDays).toBe(91);
  });
});
