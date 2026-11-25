import type { ScreenEntry } from '../data.js';
import type { FloorQuery, ReportModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    floor: { params: FloorQuery; model: ReportModel };
  }
}

export const screen: ScreenEntry<'floor'> = {
  key: 'floor',
  // Live: `/config`, `/state` and `/me` through the query client into `FloorData` (as v1 `useFloorData`), then
  // `reportModel` on Step 1. The routes themselves run `Page.tsx`, which keeps the wizard's state.
  provider: () => Promise.reject(new Error('not implemented')),
  frozen: (query) => import('./fixture.js').then((m) => m.floorFixture(query.maintenance)),
};
