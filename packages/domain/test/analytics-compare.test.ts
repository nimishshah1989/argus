import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData, type FigureResult } from '../src/index.js';
import { ENGINE_DATA, read, type FigureKey } from './answer-key/fixture.js';

/**
 * The Compare Machines figure (ticket 43, packet 43a) against the frozen 11 November key: the whole page, never a
 * slice and never a tolerance. The key was drawn with VC-28 and VC-22 selected in the Vertical Machining Center
 * category; the figure pins that pair from the data (the most populous category, its first two machines by worst
 * age-adjusted health), so the test derives the drill from the page's own headers instead of naming them.
 */

const AS_OF = '2026-11-11';
const COMPARE = read<FigureKey>('compare.json');

function compute(data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === 'compare');
  if (!found) throw new Error('the engine knows no figure compare');
  return found;
}

describe('the compare figure', () => {
  it("equals the key's whole Compare Machines page", () => {
    const computed = compute();
    // Red first: no computer was registered for compare, so the engine answered not_computed.
    expect(computed.status).toBe('ready');
    expect(computed.value).toEqual(COMPARE);
  });

  it('drills the two machines the page compares, each a real machine row', () => {
    const computed = compute();
    const value = computed.value as unknown as FigureKey;
    const header = value.pages[0]?.tables[0]?.header ?? [];
    const compared = header.slice(1).filter((id) => id !== '');
    expect(compared).toHaveLength(2);
    expect(computed.drill.type).toBe('machine');
    // The engine sorts and dedupes the ids the computer names: the page's two machines, each once.
    expect(computed.drill.ids).toEqual([...compared].sort());
    const known = new Set(ENGINE_DATA.machines.map((machine) => machine.id));
    expect(computed.drill.ids.every((id) => known.has(id))).toBe(true);
  });
});
