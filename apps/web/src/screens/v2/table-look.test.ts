import { describe, expect, it } from 'vitest';
import { FROZEN, PROVIDERS } from './data.js';
import { annualReportModel } from './annual-report/adapter.js';
import { monthlyReportModel } from './monthly-report/adapter.js';
import { shiftKpisModel } from './shift-kpis/adapter.js';
import { realReply } from './figures/real-reply.js';
import { answerKey, realT } from './printed-page/test-support.js';

/**
 * ADR 0061 (Nimish, 26 Nov: "no conditional formatting in any of them"): tables colour themselves from each column's
 * declared look. Every v2 screen's table models are built from their fixtures here, and every number column must
 * declare a look (a meaning, or `plain` for an id, a date or a count). A column the kit cannot read lands below.
 *
 * Both lists only shrink: a screen that gains a fixture builder leaves SKIP; a column given a look leaves UNDECLARED.
 * Never add to either.
 */
const UNDECLARED = new Set<string>([]);

/** Screens whose model needs the live server here (no frozen provider and no fixture builder yet). */
const SKIP = new Set([
  'age',
  'bottleneck',
  'breakdown-log',
  'cell-change-log',
  'dashboard',
  'energy',
  'footprint',
  'forecast-lab',
  'machine',
  'machines-register',
  'manpower',
  'money-matters',
  'oem',
  'why-why',
]);

const MODELS: Record<string, () => Promise<unknown>> = {
  'annual-report': async () =>
    annualReportModel(answerKey('annual-report', 'annual-report', 42), realT),
  'monthly-report': async () =>
    monthlyReportModel(answerKey('monthly-report', 'monthly-report', 42), realT),
  'shift-kpis': async () => shiftKpisModel(realReply(), realT),
};

type Head = { label: string; numeric: boolean; look?: string };
type Found = { title: string; header: Head[] };

/** Every table model inside a screen model: anything with a `header` of `{ label, numeric }` and `rows`. */
function tablesIn(value: unknown, into: Found[] = [], seen = new Set<unknown>()): Found[] {
  if (!value || typeof value !== 'object' || seen.has(value)) return into;
  seen.add(value);
  const o = value as Record<string, unknown>;
  if (
    Array.isArray(o.header) &&
    Array.isArray(o.rows) &&
    o.header.every((h) => typeof h === 'object' && h !== null && 'numeric' in h)
  )
    into.push({ title: String(o.title ?? ''), header: o.header as Head[] });
  for (const v of Object.values(o)) tablesIn(v, into, seen);
  return into;
}

async function modelOf(key: string): Promise<unknown> {
  const provider = (FROZEN[key] ?? PROVIDERS[key]) as (p: object, c: object) => Promise<unknown>;
  return MODELS[key]?.() ?? provider({}, {});
}

describe('every table column declares its look (ADR 0061)', () => {
  const keys = Object.keys(PROVIDERS).sort();
  const built = keys.filter((k) => !SKIP.has(k));
  const seen = new Set<string>();

  for (const key of built)
    it(`${key}: no number column without a look`, async () => {
      const bare = tablesIn(await modelOf(key)).flatMap((t) =>
        t.header
          .filter((h) => h.numeric && !h.look)
          .map((h) => `${key}|${t.title}|${h.label.trim()}`),
      );
      bare.forEach((b) => seen.add(b));
      expect(bare.filter((b) => !UNDECLARED.has(b))).toEqual([]);
    });

  it('the lists only name what is still true', () => {
    expect(
      [...SKIP].filter((k) => !keys.includes(k)),
      'skipped but not a screen',
    ).toEqual([]);
    expect(
      [...UNDECLARED].filter((u) => !seen.has(u)),
      'listed but declared now: take it off',
    ).toEqual([]);
  });
});
