import type { ScreenEntry } from '../data.js';
import type { ActionCenterModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'action-center': { params: Record<string, never>; model: ActionCenterModel };
  }
}

export const screen: ScreenEntry<'action-center'> = {
  key: 'action-center',
  provider: () => import('./fixture.js').then((m) => m.actionCenterFixture),
};
