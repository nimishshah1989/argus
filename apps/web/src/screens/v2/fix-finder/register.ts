import type { ScreenEntry } from '../data.js';
import type { FixFinderModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'fix-finder': { params: Record<string, never>; model: FixFinderModel };
  }
}

export const screen: ScreenEntry<'fix-finder'> = {
  key: 'fix-finder',
  provider: () => import('./source.js').then((m) => m.fixFinderFromKey()),
};
