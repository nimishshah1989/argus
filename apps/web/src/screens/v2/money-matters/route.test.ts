import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { liveScreen } from '../live.js';

/**
 * Ticket 679 (ADR 0031 §6; Nimish, 20 Nov): S22 is live at v1's address `/analytics/cost`, and v1's page is deleted
 * in the same PR. The page itself, and the refusal for a login without money rights, come from the provider.
 */
describe('S22 Money Matters at its v1 address', () => {
  it('serves the v2 page for /analytics/cost, with no ?screen= and for one it does not know', () => {
    for (const screen of [null, 'money-matters', 'no-such-screen'])
      expect(liveScreen('cost', screen)?.key, String(screen)).toBe('cost:money-matters');
  });

  it('has no v1 MoneyPage left to fall back to', () => {
    expect(existsSync(new URL('../../analytics/MoneyPage.tsx', import.meta.url))).toBe(false);
  });
});
