import type { ScreenEntry } from '../data.js';
import type { DataChecklistModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'data-checklist': { params: Record<string, never>; model: DataChecklistModel };
  }
}

export const screen: ScreenEntry<'data-checklist'> = {
  key: 'data-checklist',
  provider: () => import('./fixture.js').then((m) => m.dataChecklistFixture),
};
