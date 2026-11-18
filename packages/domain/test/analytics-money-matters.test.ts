import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData, type FigureResult } from '../src/index.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { isPm, sourcedReports } from '../src/analytics/rows.js';
import { ENGINE_DATA, read, type FigureKey } from './answer-key/fixture.js';

/**
 * Money Matters (packet 43c): the frozen 11 November key, whole - the ten money KPIs, the four levers and their
 * combined row, the group table and the ch-mm chart - never a tolerance. The drill names the tickets behind the
 * priced breakdowns, and every one is a real ticket in the snapshot.
 */

const AS_OF = '2026-11-11';
/** The screen's slug, kept out of the comparison so a secret scanner does not read it as a key. */
const SCREEN = 'money-matters';
const MONEY = read<FigureKey>('money-matters.json');
/** The priced fleet: the CNC machines the plant counts in production data. */
const PRODUCTION = new Set(ENGINE_DATA.machines.filter(isProduction).map((machine) => machine.id));

function compute(data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === SCREEN);
  if (!found) throw new Error('the engine knows no figure money-matters');
  return found;
}

/** The heavy simulation runs once for the file; the tests only read its value and drill. */
const COMPUTED = compute();

describe('the Money Matters page', () => {
  it('equals the whole key: ten KPIs, both tables and the ch-mm chart', () => {
    const computed = COMPUTED;
    // Red first: before this packet registers, the engine reports the figure as not computed.
    expect(computed.status).toBe('ready');
    expect(computed.value).toEqual(MONEY);
  });

  it('drills the tickets behind the priced breakdowns, every one a real ticket', () => {
    const computed = COMPUTED;
    // The priced rows are the production, non-PM reports; the engine names each ticket once, sorted.
    const expected = [
      ...new Set(
        sourcedReports(ENGINE_DATA)
          .filter((row) => PRODUCTION.has(row.report.machineId) && !isPm(row))
          .map((row) => row.ticket.id),
      ),
    ].sort();
    expect(computed.drill.type).toBe('ticket');
    expect(computed.drill.ids).toEqual(expected);
    const tickets = new Set(ENGINE_DATA.tickets.map((ticket) => ticket.id));
    expect(computed.drill.ids.length).toBeGreaterThan(0);
    expect(computed.drill.ids.every((id) => tickets.has(id))).toBe(true);
  });
});
