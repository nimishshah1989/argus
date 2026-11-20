import type { ScreenEntry } from '../data.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

declare module '../data.js' {
  interface Screens {
    'bd-pm': { params: Record<string, never>; model: PrintedPageModel };
  }
}

export const screen: ScreenEntry<'bd-pm'> = {
  key: 'bd-pm',
  provider: () => import('./source.js').then((m) => m.bdPmModelFromKey()),
};
