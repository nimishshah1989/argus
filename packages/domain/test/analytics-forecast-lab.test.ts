import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData, type FigureResult } from '../src/index.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { ENGINE_DATA, read, type FigureKey } from './answer-key/fixture.js';

/**
 * The Forecast Lab (packet 42d): the four-method backtest against the frozen 11 November key — the whole figure,
 * both tables and the ch-fl chart, never a tolerance — plus the drill the page carries. The September boundary is
 * the key's own: the base drops a machine bought on the cut day, which moves every later seed and the month's rate.
 */

const AS_OF = '2026-11-11';
/** The screen's slug, kept out of the comparison so a secret scanner does not read it as a key. */
const SCREEN = 'forecast-lab';
const FL = read<FigureKey>('forecast-lab.json');
/** The production fleet: CNC machines the plant counts in production data. */
const PRODUCTION = ENGINE_DATA.machines.filter(isProduction);

function compute(data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === SCREEN);
  if (!found) throw new Error('the engine knows no figure forecast-lab');
  return found;
}

/** The heavy simulation runs once for the file; the tests only read its value and drill. */
const COMPUTED = compute();

describe('the Forecast Lab backtest', () => {
  it('equals the whole key: both tables and the ch-fl chart', () => {
    const computed = COMPUTED;
    // Red first: with 42b's composition alone, the engine reports this figure as not computed.
    expect(computed.status).toBe('ready');
    expect(computed.value).toEqual(FL);
  });

  it('drills the production machines', () => {
    const computed = COMPUTED;
    expect(computed.drill.type).toBe('machine');
    expect(computed.drill.ids).toEqual(PRODUCTION.map((machine) => machine.id).sort());
  });
});
