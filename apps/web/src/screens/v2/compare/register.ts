import type { ScreenEntry } from '../data.js';
import type { CompareModel, CompareParams } from './model.js';

declare module '../data.js' {
  interface Screens {
    compare: { params: CompareParams; model: CompareModel };
  }
}

export const screen: ScreenEntry<'compare'> = {
  key: 'compare',
  provider: (pair) => import('./fixture.js').then((m) => m.compareFixture(pair)),
};
