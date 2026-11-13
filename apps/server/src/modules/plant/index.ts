import { defineModule } from '../../kernel/index.js';
import { registerPlantRoutes } from './routes.js';

export {
  hasShifts,
  insertGlossaryTerms,
  insertListItems,
  insertMachines,
  insertSegments,
  insertSettings,
  insertShifts,
  setMachineCriticality,
} from './repo.js';
export { canWrite, forbidden } from './routes.js';

export const plantModule = defineModule({ name: 'plant', register: registerPlantRoutes });
