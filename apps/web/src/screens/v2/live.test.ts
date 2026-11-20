import { Navigate } from 'react-router-dom';
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
      ['machines', 'a5-energy'],
      ['breakdowns', 'shift-kpis'],
      ['forecast-scorecard', 'a9-bottleneck-forecast'],
      ['forecast-scorecard', 'forecast-lab'],
    ] as const)
      expect(liveScreen(group, screen), `${group} ${screen}`).not.toBeNull();
    expect(liveScreen('machines', null)).not.toBeNull();
  });

  it('opens a group whose first screen is v2 on that screen for an unknown address, never on a v1 page', () => {
    expect(liveScreen('machines', 'no-such-screen')).not.toBeNull();
    expect(liveScreen('forecast-scorecard', 'no-such-screen')).not.toBeNull();
    expect(liveScreen('forecast-scorecard', null)).not.toBeNull();
  });

  it('leaves every other screen to the v1 page', () => {
    expect(liveScreen('machines', 'compare')).toBeNull();
    expect(liveScreen('breakdowns', null)).toBeNull();
    expect(liveScreen('breakdowns', 'cell-change-log')).toBeNull();
    expect(liveScreen('today', 'cell-change-log')).toBeNull();
  });

  it('sends an unknown Machines screen to the register, never to a v1 copy of it', () => {
    for (const bogus of ['bogus', 'machine-page', '']) {
      const sent = liveScreen('machines', bogus);
      expect(sent?.type, bogus).toBe(Navigate);
      expect((sent?.props as { to: string }).to, bogus).toBe(
        '/analytics/machines?screen=registers',
      );
    }
  });
});
