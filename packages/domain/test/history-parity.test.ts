import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { run } from '../src/index.js';
import { ENGINE_DATA } from './answer-key/fixture.js';
import { COSMOS_FROM, HISTORY, withFrom } from './history-fixture.js';

/**
 * Ticket 621, ADR 0027, goal G3.3: loading 2022–2025 history beside the 2026 data moves no figure. With the plant's
 * data-from date set to 2026-01-01 and no span named, every figure equals the 2026-only run, value and drill.
 */

const AS_OF = '2026-11-11';

describe('history parity (data-from date)', () => {
  it('the history copy really holds older years (so the test can fail)', () => {
    expect(HISTORY.tickets.length).toBe(ENGINE_DATA.tickets.length * 3);
    expect(HISTORY.reports.some((r) => r.date.startsWith('2022-'))).toBe(true);
  });

  it('with dataFrom 2026-01-01, 2024 and 2022 history moves no figure', () => {
    const alone = run(ENGINE_DATA, AS_OF, DEFAULT_PROFILE).figures;
    const loaded = run(withFrom(HISTORY, COSMOS_FROM), AS_OF, DEFAULT_PROFILE).figures;
    expect(loaded).toEqual(alone);
  });
});
