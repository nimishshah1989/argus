import type { ScreenEntry } from '../data.js';
import type { TeamFocusModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'team-focus': { params: Record<string, never>; model: TeamFocusModel };
  }
}

export const screen: ScreenEntry<'team-focus'> = {
  key: 'team-focus',
  provider: () => import('./fixture.js').then((m) => m.teamFocusFixture),
};
