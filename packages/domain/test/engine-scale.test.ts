import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS } from '../src/analytics/computers.js';
import { run } from '../src/analytics/engine.js';
import type { EngineData } from '../src/index.js';
import { ENGINE_DATA } from './answer-key/fixture.js';
import { scalePlant } from './scale-plant.js';

/**
 * Ticket 75, packet 75e: a full run on the 10,000-row plant of `scale-plant.ts` takes 20 seconds or less (it was
 * 30 s at 13,500 rows; the run here takes a few seconds, so the limit only fails a real regression). The same file
 * holds the rule the run's memory depends on: no figure edits the rows it is given.
 */

const LIMIT_MS = 20_000;

/** A deep copy no code can edit: any push, sort or write on it throws in strict mode. */
function deepFrozen<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (node: unknown): void => {
    if (node === null || typeof node !== 'object' || Object.isFrozen(node)) return;
    Object.freeze(node);
    for (const child of Object.values(node)) freeze(child);
  };
  freeze(copy);
  return copy;
}

describe('a full run on a 10,000-row plant', () => {
  it('finishes in 20 seconds or less and computes every figure it has a computer for', () => {
    const data = scalePlant();
    const started = performance.now();
    const result = run(data, '2026-11-11', DEFAULT_PROFILE);
    const took = performance.now() - started;
    expect(result.rows.reports).toBe(data.reports.length);
    const ready = result.figures
      .filter((figure) => figure.status === 'ready')
      .map((figure) => figure.key)
      .sort();
    expect(ready).toEqual(Object.keys(COMPUTERS).sort());
    expect(took).toBeLessThanOrEqual(LIMIT_MS);
  }, 60_000);
});

describe('the engine never edits its input', () => {
  it.each([
    ['the 11 Nov answer-key plant', (): EngineData => ENGINE_DATA],
    ['the 10,000-row plant', scalePlant],
  ])(
    'runs on a deep-frozen copy of %s and gives the same figures',
    (_name, make) => {
      const data = make();
      const frozen = deepFrozen(data);
      expect(run(frozen, '2026-11-11', DEFAULT_PROFILE)).toEqual(
        run(data, '2026-11-11', DEFAULT_PROFILE),
      );
    },
    60_000,
  );
});
