import { describe, expect, it } from 'vitest';
import { FROZEN, PROVIDERS } from './data.js';
import { annualReportModel } from './annual-report/adapter.js';
import { monthlyReportModel } from './monthly-report/adapter.js';
import { shiftKpisModel } from './shift-kpis/adapter.js';
import { en } from '@uptimo/shared/i18n';
import { ENGINE_DATA } from '../../../../../packages/domain/test/answer-key/fixture.js';
import { fill } from '../../i18n/fill.js';
import { AS_OF, realReply } from './figures/real-reply.js';
import type { Translate } from './figures/read.js';
import { answerKey, realT } from './printed-page/test-support.js';
import { ageModel } from './age/adapter.js';
import { bottleneckModel, FIGURE as BOTTLENECK } from './bottleneck/adapter.js';
import { liveLog } from './breakdown-log/live.js';
import { EMPTY_QUERY } from './breakdown-log/model.js';
import { cellLogModel } from './cell-change-log/adapter.js';
import { dashboardModel } from './dashboard/adapter.js';
import { energyModel } from './energy/adapter.js';
import { footprintModel } from './footprint/adapter.js';
import { forecastLabModel, FIGURE as FORECAST } from './forecast-lab/adapter.js';
import { machinePageModel } from './machine/adapter.js';
import { registersModel } from './machines-register/adapter.js';
import { manpowerModel, FIGURE as MANPOWER } from './manpower/adapter.js';
import { moneyMattersModel } from './money-matters/adapter.js';
import { oemModel } from './oem/adapter.js';
import { whyWhyModel, FIGURE as WHY_WHY } from './why-why/adapter.js';

/**
 * ADR 0061 (Nimish, 26 Nov: "no conditional formatting in any of them"): tables colour themselves from each column's
 * declared look. Every v2 screen's table models are built from their fixtures here, and every number column must
 * declare a look (a meaning, or `plain` for an id, a date or a count). A column the kit cannot read lands below.
 *
 * Both lists only shrink: a screen that gains a fixture builder leaves SKIP; a column given a look leaves UNDECLARED.
 * Never add to either.
 */
const UNDECLARED = new Set<string>([
  // bd-pm: the two month grids the engine prints with no title, so neither header nor title says BD or PM.
  'bd-pm||Jan',
  'bd-pm||Feb',
  'bd-pm||Mar',
  'bd-pm||Apr',
  'bd-pm||May',
  'bd-pm||Jun',
  'bd-pm||Jul',
  'bd-pm||Aug',
  'bd-pm||Sep',
  'bd-pm||Oct',
  'bd-pm||Nov',
  'bd-pm||Dec',
  'bd-pm||Q1 Avg',
  'bd-pm||Q2 Avg',
  'bd-pm||Q3 Avg',
  'bd-pm||Q4 Avg',
  'bd-pm||Year 2026',
]);

/** Screens whose model needs the live server here (no frozen provider and no fixture builder yet). */
const SKIP = new Set<string>([]);

/** The catalogue's English filled as the kit fills it (`{name}`), for the adapters that take a `Translate`. */
const fillT: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const machines = ENGINE_DATA.machines.map((m) => ({
  id: m.id,
  code: m.code,
  category: m.category ?? null,
  cell: m.cell ?? null,
}));

/** Each screen's model from the engine's frozen 11 November reply, built the way its own tests build it. */
const MODELS: Record<string, () => Promise<unknown>> = {
  'annual-report': async () =>
    annualReportModel(answerKey('annual-report', 'annual-report', 42), realT),
  'monthly-report': async () =>
    monthlyReportModel(answerKey('monthly-report', 'monthly-report', 42), realT),
  'shift-kpis': async () => shiftKpisModel(realReply(), realT),
  age: async () => ageModel(realReply(), fillT),
  bottleneck: async () =>
    bottleneckModel(answerKey('a9-bottleneck-forecast', BOTTLENECK, 42), realT, (id) => id),
  'breakdown-log': async () => liveLog(realReply(), EMPTY_QUERY, realT),
  'cell-change-log': async () =>
    cellLogModel(realReply(), fillT, { codeOf: (id) => id, role: 'head', today: AS_OF }),
  dashboard: async () =>
    dashboardModel(
      { reply: realReply(), open: { tickets: [], now: `${AS_OF}T09:00:00.000Z` }, board: null, machines },
      fillT,
    ),
  energy: async () => energyModel(realReply(), realT),
  footprint: async () => footprintModel(realReply(), fillT),
  'forecast-lab': async () => forecastLabModel(answerKey('forecast-lab', FORECAST, 42), realT),
  machine: async () =>
    machinePageModel(
      realReply(),
      { param: 'HMC-2', machines, tickets: [], timeZone: 'Asia/Kolkata' },
      fillT,
    ),
  'machines-register': async () => registersModel(realReply(), fillT),
  manpower: async () => manpowerModel(answerKey('a4-manpower', MANPOWER, 41), realT),
  'money-matters': async () => moneyMattersModel(realReply(), realT, { money: true }),
  oem: async () => oemModel(realReply(), fillT, { mayDecide: false }),
  'why-why': async () => whyWhyModel(answerKey('a6-why-why', WHY_WHY, 41), realT),
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
      const model = await modelOf(key);
      expect(model, 'the fixture builds no model').not.toBeNull();
      const bare = tablesIn(model).flatMap((t) =>
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
