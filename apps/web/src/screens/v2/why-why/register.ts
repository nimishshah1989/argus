import type { ScreenEntry } from '../data.js';
import type { WhyWhyModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'why-why': { params: Record<string, never>; model: WhyWhyModel };
  }
}

export const screen: ScreenEntry<'why-why'> = {
  key: 'why-why',
  provider: () => import('./source.js').then((m) => m.whyWhyModelFromKey()),
};
