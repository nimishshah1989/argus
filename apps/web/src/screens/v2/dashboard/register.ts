import type { ScreenEntry } from '../data.js';
import type { DashboardModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    /** One dashboard for the plant, from the engine's figures and the desk's open tickets. */
    dashboard: { params: Record<string, never>; model: DashboardModel };
  }
}

export const screen: ScreenEntry<'dashboard'> = {
  key: 'dashboard',
  provider: async (_, { client }) => {
    const [{ catalogue }, { dashboardFacts }, { dashboardModel }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
      import('./adapter.js'),
    ]);
    return dashboardModel(await dashboardFacts(client), catalogue);
  },
};
