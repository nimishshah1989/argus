import { defineModule } from '../../kernel/index.js';
import { registerPlantRoutes } from './routes.js';

export { hasShifts, setMachineCriticality } from './repo/config.js';
export {
  activeListItems,
  activeMachineByCode,
  listItem,
  listItemOf,
  listItemsByIds,
  listItemsOf,
  machinesByIds,
  setting,
  shiftCodeAt,
  shiftsOf,
  shiftWindows,
  type MachineRow,
} from './repo/reads.js';
export { canWrite, forbidden } from './routes.js';

export const plantModule = defineModule({ name: 'plant', register: registerPlantRoutes });
