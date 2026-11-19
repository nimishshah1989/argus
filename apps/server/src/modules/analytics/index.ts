import { defineModule } from '../../kernel/index.js';
import { registerAnalyticsRoutes } from './routes.js';

export { notStored, runForTenant, type FigureStore } from './service.js';
export { loadEngineData } from './load.js';
export { profileOfKey, snapshotStore, type FigureProfile } from './snapshot.js';
export { readProfile } from './profile.js';
export { servedRun } from './served.js';
export {
  ENGINE_FREEZE_QUEUE,
  freezeTenant,
  runEngineFreeze,
  type EngineFreezeOptions,
  type EngineFreezeResult,
} from './freeze.js';
export {
  ENGINE_FREEZE_CRON,
  ENGINE_RUN_CRON,
  startEngineJobs,
  type EngineJobDeps,
} from './jobs.js';
export {
  ENGINE_RUN_QUEUE,
  inspectTenant,
  runEngineRun,
  scoreTenant,
  type EngineRunOptions,
  type EngineRunResult,
} from './run.js';

export const analyticsModule = defineModule({
  name: 'analytics',
  register: (app, config) => registerAnalyticsRoutes(app, config.pool),
});
