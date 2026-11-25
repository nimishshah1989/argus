import i18n from 'i18next';
import { getConfig, getMe, getState } from '../../../api.js';
import { openOnMachines, type FloorData } from '../../../faces/floor/use-floor.js';
import type { ScreenEntry } from '../data.js';
import { reportModel } from './adapter.js';
import type { FloorQuery, ReportModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    floor: { params: FloorQuery; model: ReportModel };
  }
}

const MAINTENANCE = ['technician', 'supervisor', 'head', 'admin'];

export const screen: ScreenEntry<'floor'> = {
  key: 'floor',
  // Live: `/config`, `/state` and `/me` through the query client into `FloorData` (as v1 `useFloorData`), then
  // `reportModel` on Step 1. The routes themselves run `Page.tsx`, which keeps the wizard's state.
  provider: async (_query, { client }) => {
    const read = <T>(queryKey: string, queryFn: () => Promise<T>) =>
      client ? client.fetchQuery({ queryKey: [queryKey], queryFn }) : queryFn();
    const [config, state, me] = await Promise.all([
      read('config', getConfig),
      read('state', getState),
      read('me', getMe),
    ]);
    const user = me.user;
    const data: FloorData = {
      config,
      me: user,
      open: openOnMachines(state.open),
      openAll: state.open,
      maintenance: MAINTENANCE.includes(user.role),
      who: user.title ? `${user.name} (${user.title})` : user.name,
    };
    const input = {
      ...{ query: '', group: null, machine: null, kind: 'stopped' as const, problem: '' },
      ...{ startNow: false, sheet: null, sent: null, recent: [] },
    };
    return reportModel(data, input, i18n.t.bind(i18n));
  },
  frozen: (query) => import('./fixture.js').then((m) => m.floorFixture(query.maintenance)),
};
