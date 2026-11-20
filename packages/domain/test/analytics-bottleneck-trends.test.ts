import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData, type FigureResult } from '../src/index.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { ENGINE_DATA, read, type FigureKey } from './answer-key/fixture.js';
import { withoutCodeFields } from './answer-key/rekey.js';

/**
 * A9's maintenance trends, repeat faults and the two charts (packet 42c): tables 6 to 8 and both charts whole against
 * the frozen 11 November key. The trend test reads each episode's last day in its own machine's observation window
 * (a fault logged again on the next day is one episode), so a hard-coded page cannot pass. The map's lane jitter and
 * bubble radius are pinned here because the key carries no drawing coordinates for them.
 */

const AS_OF = '2026-11-11';
const SCREEN = 'a9-bottleneck-forecast';
const A9 = read<FigureKey>('a9-bottleneck-forecast.json');
/** The production fleet: CNC machines the plant counts in production data. */
const PRODUCTION = ENGINE_DATA.machines.filter(isProduction);

interface MapPoint {
  x: number;
  y: number;
  id: string;
  cat: string;
  h: number;
  a: number;
  n: number;
}

function compute(data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === SCREEN);
  if (!found) throw new Error('the engine knows no figure a9-bottleneck-forecast');
  return found;
}

function pageOf(computed: FigureResult): FigureKey['pages'][number] {
  const value = computed.value as unknown as FigureKey | null;
  const page = value?.pages[0];
  if (!page) throw new Error('the A9 figure printed no page');
  return page;
}

/** The heavy trend page runs once for the file; the tests only read its value, tables, charts and drill. */
const COMPUTED = compute();
const PAGE = pageOf(COMPUTED);

/** The platform's deterministic jitter inside a lane: an id hash, applied only when the lane has peers. */
function jitter(id: string, peers: number): number {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) % 997;
  return peers > 1 ? ((hash % 100) / 100 - 0.5) * 0.62 : 0;
}

/** The bubble radius the platform draws: 4 plus 0.7 times the square root of the machine's BD hours, capped at 15. */
const radiusOf = (hours: number): number => Math.max(4, Math.min(15, 4 + Math.sqrt(hours) * 0.7));

/** The lane a point sits in, found by its category's own tick label and machine count. */
function laneOf(chart: FigureKey['pages'][number]['charts'][number], point: MapPoint): number {
  const lane = chart.tickLabels.y?.findIndex((label) => label.startsWith(`${point.cat} (`));
  if (lane === undefined || lane < 0) throw new Error(`no lane labelled ${point.cat}`);
  return lane;
}

describe('the A9 maintenance trends, repeat faults and charts', () => {
  it("equals the key's two trend tables, the repeat faults and both charts", () => {
    const computed = COMPUTED;
    // Red first: with 42b's figure registered alone, tables 6 to 8 and both charts print null.
    expect(computed.status).toBe('ready');
    const page = PAGE;
    const key = A9.pages[0]!;
    expect(page.tables[6]).toEqual(key.tables[6]);
    expect(page.tables[7]).toEqual(key.tables[7]);
    expect(page.tables[8]).toEqual(key.tables[8]);
    expect(withoutCodeFields(page.charts[0])).toEqual(key.charts[0]);
    expect(page.charts[1]).toEqual(key.charts[1]);
  });

  it("pins the map's lanes, points and radii", () => {
    const page = PAGE;
    const chart = page.charts[0]!;
    expect(chart.axes).toEqual({
      x: 'Unavailable (% of machine hours) — further right = more downtime',
      y: '',
    });
    expect(chart.datasets.map((dataset) => dataset.label)).toEqual([
      'Low',
      'Watch',
      'High',
      'Critical',
    ]);
    // Only High and Critical draw a machine-code label; the engine sends no drawing labels at all.
    expect(chart.labels).toEqual([]);
    const points = chart.datasets.flatMap((dataset) => dataset.data as MapPoint[]);
    expect(points).toHaveLength(PRODUCTION.length);
    for (const point of points) {
      expect(point.x).toBe(Math.round((1 - point.a) * 1000) / 10);
      const lane = laneOf(chart, point);
      if (point.n === 1) expect(point.y).toBe(lane);
      expect(point.y).toBeCloseTo(lane + jitter(point.id, point.n), 10);
      expect(radiusOf(point.h)).toBeGreaterThanOrEqual(4);
      expect(radiusOf(point.h)).toBeLessThanOrEqual(15);
    }
    // The three pinned radii: WJ-01 83.69 h (inside the cap), TMC-2 307.57 h (capped) and VC-11 48.58 h.
    expect(radiusOf(83.69)).toBeCloseTo(10.4038, 3);
    expect(radiusOf(307.57)).toBe(15);
    expect(radiusOf(48.58)).toBeCloseTo(8.879, 3);
  });

  it("keeps 42a and 42b's slots whole and still drills the production machines", () => {
    const computed = COMPUTED;
    expect(computed.drill.type).toBe('machine');
    expect(computed.drill.ids).toEqual(PRODUCTION.map((machine) => machine.id).sort());
    const page = PAGE;
    const key = A9.pages[0]!;
    // 42c fills its own indices; it never renumbers the slots packets 42a and 42b filled.
    expect(page.kpis).toEqual(key.kpis);
    expect(page.tables.slice(0, 6)).toEqual(key.tables.slice(0, 6));
  });
});
