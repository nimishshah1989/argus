import type { ScreenEntry } from '../data.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

declare module '../data.js' {
  interface Screens {
    manpower: { params: Record<string, never>; model: PrintedPageModel };
  }
}

export const screen: ScreenEntry<'manpower'> = {
  key: 'manpower',
  provider: () => import('./source.js').then((m) => m.manpowerModelFromKey()),
};
