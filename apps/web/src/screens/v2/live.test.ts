import { describe, expect, it } from 'vitest';
import { liveScreen } from './live.js';

describe('which v2 screens are live at their v1 address', () => {
  it('serves the cell change log at the Machines group’s address', () => {
    expect(liveScreen('machines', 'cell-change-log')).not.toBeNull();
  });

  it('serves the Dashboard at Today’s address, with or without ?screen=, and leaves Team Focus and a rows-behind link to v1', () => {
    expect(liveScreen('today', null)).not.toBeNull();
    expect(liveScreen('today', 'dashboard')).not.toBeNull();
    expect(liveScreen('today', 'team-focus')).toBeNull();
    expect(liveScreen('today', null, true)).toBeNull();
  });

  it('leaves every other screen, and a group’s first page, to the v1 page', () => {
    expect(liveScreen('machines', null)).toBeNull();
    expect(liveScreen('machines', 'a8-age')).toBeNull();
    expect(liveScreen('breakdowns', 'cell-change-log')).toBeNull();
    expect(liveScreen('today', 'cell-change-log')).toBeNull();
  });
});
