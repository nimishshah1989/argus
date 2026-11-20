import { describe, expect, it } from 'vitest';
import { liveScreen } from './live.js';

describe('which v2 screens are live at their v1 address', () => {
  it('serves the six Machines and Breakdowns screens at the address v1 used, and the Machines group opens on its register', () => {
    for (const [group, screen] of [
      ['machines', 'cell-change-log'],
      ['machines', 'registers'],
      ['machines', 'a8-age'],
      ['machines', 'a7-footprint'],
      ['breakdowns', 'fix-finder'],
      ['breakdowns', 'a10-problems'],
    ] as const)
      expect(liveScreen(group, screen)).not.toBeNull();
    expect(liveScreen('machines', null)).not.toBeNull();
  });

  it('leaves every other screen to the v1 page', () => {
    expect(liveScreen('machines', 'compare')).toBeNull();
    expect(liveScreen('breakdowns', null)).toBeNull();
    expect(liveScreen('breakdowns', 'cell-change-log')).toBeNull();
    expect(liveScreen('today', 'cell-change-log')).toBeNull();
  });
});
