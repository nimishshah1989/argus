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
      ['breakdowns', 'a4-manpower'],
      ['breakdowns', 'a6-why-why'],
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

  it('serves the Dashboard at Today’s address, with or without ?screen= or an unknown one, and leaves Team Focus to v1', () => {
    expect(liveScreen('today', null)).not.toBeNull();
    expect(liveScreen('today', 'dashboard')).not.toBeNull();
    expect(liveScreen('today', 'no-such-screen')).not.toBeNull();
    expect(liveScreen('today', 'cell-change-log')).not.toBeNull();
    expect(liveScreen('today', 'team-focus')).toBeNull();
  });

  it('keys every page by its group and screen, so a change of ?screen= remounts and one screen never draws the model of the one before', () => {
    const key = (group: string, screen: string | null) => liveScreen(group, screen)?.key;
    expect(key('today', null)).toBe('today:dashboard');
    expect(key('today', 'bogus')).toBe('today:dashboard');
    expect(key('machines', null)).toBe('machines:registers');
    const keys = [
      key('today', null),
      key('machines', 'registers'),
      key('machines', 'a8-age'),
      key('machines', 'a7-footprint'),
      key('machines', 'cell-change-log'),
      key('breakdowns', 'fix-finder'),
      key('breakdowns', 'a10-problems'),
      key('breakdowns', 'a4-manpower'),
      key('breakdowns', 'a6-why-why'),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('leaves every other screen to the v1 page', () => {
    expect(liveScreen('machines', 'compare')).toBeNull();
    expect(liveScreen('breakdowns', null)).toBeNull();
    expect(liveScreen('breakdowns', 'cell-change-log')).toBeNull();
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
