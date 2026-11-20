import type { ScreenEntry } from '../data.js';
import type { DashboardModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    /** One dashboard for the plant. */
    dashboard: { params: Record<string, never>; model: DashboardModel };
  }
}

export const screen: ScreenEntry<'dashboard'> = {
  key: 'dashboard',
  provider: () => import('./fixture.js').then((m) => m.dashboardFixture),
};
