import { defineModule } from '../../kernel/index.js';
import { registerPlantRoutes } from './routes.js';

export { hasShifts, setMachineCriticality } from './repo/config.js';
export { machinesByIds, shiftWindows, type MachineRow } from './repo/reads.js';
export {
  insertGlossaryTerms,
  insertListItems,
  insertMachines,
  insertSegments,
  insertSettings,
  insertShifts,
} from './repo/seed.js';
export { canWrite, forbidden } from './routes.js';

export const plantModule = defineModule({ name: 'plant', register: registerPlantRoutes });
