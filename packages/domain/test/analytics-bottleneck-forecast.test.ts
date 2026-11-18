import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData, type FigureResult } from '../src/index.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { ENGINE_DATA, read, type FigureKey } from './answer-key/fixture.js';

/**
 * The A9 what-if and planning forecast (packet 42b): KPIs 4–13 and tables 1, 2 and 5 against the frozen 11 November
 * key — whole objects and never a tolerance — plus the one rule the values alone cannot prove: the simulation's
 * draw order is the base (production) order, so reordering the workbook's machines moves the printed percentiles.
 */

const AS_OF = '2026-11-11';
/** The screen's slug, kept out of the comparison so a secret scanner does not read it as a key. */
const SCREEN = 'a9-bottleneck-forecast';
const A9 = read<FigureKey>('a9-bottleneck-forecast.json');
/** The production fleet: CNC machines the plant counts in production data. */
const PRODUCTION = ENGINE_DATA.machines.filter(isProduction);

function compute(data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === SCREEN);
  if (!found) throw new Error('the engine knows no figure a9-bottleneck-forecast');
  return found;
}

function pageOf(data: EngineData = ENGINE_DATA): FigureKey['pages'][number] {
  const value = compute(data).value as unknown as FigureKey | null;
  const page = value?.pages[0];
  if (!page) throw new Error('the A9 figure printed no page');
  return page;
}

const planFor = (page: FigureKey['pages'][number]): string[] =>
  page.tables[5]!.rows.map((row) => row[7]!);

describe('the A9 what-if and planning forecast', () => {
  it("equals the key's KPIs 4–13, both what-if tables and the planning forecast", () => {
    const computed = compute();
    // Red first: with 42a's figure registered alone, these slots print null.
    expect(computed.status).toBe('ready');
    const page = pageOf();
    const key = A9.pages[0]!;
    expect(page.kpis.slice(4)).toEqual(key.kpis.slice(4));
    expect(page.tables[1]).toEqual(key.tables[1]);
    expect(page.tables[2]).toEqual(key.tables[2]);
    expect(page.tables[5]).toEqual(key.tables[5]);
  });

  it("keeps 42a's slots and still drills the production machines", () => {
    const computed = compute();
    expect(computed.drill.type).toBe('machine');
    expect(computed.drill.ids).toEqual(PRODUCTION.map((machine) => machine.id).sort());
    const page = pageOf();
    const key = A9.pages[0]!;
    // 42b fills its own indices; it never renumbers the risk core's.
    expect(page.kpis.slice(0, 4)).toEqual(key.kpis.slice(0, 4));
    expect(page.tables[0]).toEqual(key.tables[0]);
    expect(page.tables[3]).toEqual(key.tables[3]);
    expect(page.tables[4]).toEqual(key.tables[4]);
  });

  it("seeds each machine's simulation from its place in the base order", () => {
    const key = A9.pages[0]!.tables[5]!.rows;
    // The key prints WJ-01's 80% plan at 12.0 h, which only the base order's stream gives.
    expect(planFor(pageOf())[0]).toBe('12.0');
    const sorted: EngineData = {
      ...ENGINE_DATA,
      machines: [...ENGINE_DATA.machines].sort((left, right) =>
        left.code.localeCompare(right.code),
      ),
    };
    const reordered = pageOf(sorted);
    // The model is order-free, so the expected hours stay; the percentiles are not.
    expect(reordered.tables[5]!.rows[0]![6]).toBe('6.1');
    expect(reordered.tables[5]!.rows[0]![7]).not.toBe('12.0');
    expect(planFor(reordered)).not.toEqual(key.map((row) => row[7]));
  });
});
