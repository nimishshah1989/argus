import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData, type FigureResult } from '../src/index.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { ENGINE_DATA, read, type FigureKey } from './answer-key/fixture.js';

/**
 * The whole-page acceptance for ticket 42 (after 42d): the A9 page and the Forecast Lab, each run through the real
 * engine, deep-equal their frozen 11 November keys whole — every KPI, table and chart, never a tolerance — and both
 * drill the production machines. An empty plant prints null for both and names no row it did not read.
 */

const AS_OF = '2026-11-11';
/** The two screens' slugs, kept behind constants so a secret scanner does not read them as keys. */
const A9_SCREEN = 'a9-bottleneck-forecast';
const FL_SCREEN = 'forecast-lab';
const A9 = read<FigureKey>(`${A9_SCREEN}.json`);
const FL = read<FigureKey>(`${FL_SCREEN}.json`);
/** The production fleet: CNC machines the plant counts in production data. */
const PRODUCTION = ENGINE_DATA.machines.filter(isProduction);
const PRODUCTION_IDS = PRODUCTION.map((machine) => machine.id).sort();
/** A plant with no rows at all: both figures must say so rather than invent one. */
const EMPTY: EngineData = {
  ...ENGINE_DATA,
  machines: [],
  moves: [],
  tickets: [],
  tasks: [],
  reports: [],
  people: [],
  whyWhy: [],
};

function figureOf(screen: string, data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === screen);
  if (!found) throw new Error(`the engine knows no figure ${screen}`);
  return found;
}

function pageOf(computed: FigureResult): FigureKey['pages'][number] {
  const value = computed.value as unknown as FigureKey | null;
  const page = value?.pages[0];
  if (!page) throw new Error('the figure printed no page');
  return page;
}

describe('the whole A9 and Forecast Lab values', () => {
  it('prints the A9 key whole: 14 KPIs, 9 tables and both charts', () => {
    const computed = figureOf(A9_SCREEN);
    expect(computed.status).toBe('ready');
    expect(computed.value).toEqual(A9);
    const page = pageOf(computed);
    expect(page.kpis).toHaveLength(14);
    expect(page.tables).toHaveLength(9);
    expect(page.charts).toHaveLength(2);
  });

  it('prints the Forecast Lab key whole: its 2 tables and one chart', () => {
    const computed = figureOf(FL_SCREEN);
    expect(computed.status).toBe('ready');
    expect(computed.value).toEqual(FL);
    const page = pageOf(computed);
    expect(page.kpis).toHaveLength(0);
    expect(page.tables).toHaveLength(2);
    expect(page.charts).toHaveLength(1);
  });

  it('drills the production machines on both pages, every id a real machine', () => {
    const known = new Set(ENGINE_DATA.machines.map((machine) => machine.id));
    for (const screen of [A9_SCREEN, FL_SCREEN]) {
      const computed = figureOf(screen);
      expect(computed.drill.type).toBe('machine');
      expect(computed.drill.ids).toHaveLength(125);
      expect(computed.drill.ids).toEqual(PRODUCTION_IDS);
      expect(computed.drill.ids.every((id) => known.has(id))).toBe(true);
    }
  });

  it('returns null for both on an empty plant, with no rows to drill', () => {
    for (const screen of [A9_SCREEN, FL_SCREEN]) {
      const computed = figureOf(screen, EMPTY);
      expect(computed.status).toBe('ready');
      expect(computed.value).toBeNull();
      expect(computed.drill.ids).toEqual([]);
    }
  });
});
