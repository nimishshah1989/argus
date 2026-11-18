import { defineModule } from '../../kernel/index.js';
import { registerAnalyticsRoutes } from './routes.js';

export { notStored, runForTenant, type FigureStore } from './service.js';
export { loadEngineData } from './load.js';
export { profileOfKey, snapshotStore, type FigureProfile } from './snapshot.js';
export { readProfile } from './profile.js';

export const analyticsModule = defineModule({
  name: 'analytics',
  register: (app, config) => registerAnalyticsRoutes(app, config.pool),
});
