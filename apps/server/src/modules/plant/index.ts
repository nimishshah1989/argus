import { defineModule } from '../../kernel/index.js';
import { registerPlantRoutes } from './routes.js';

export { hasShifts, setMachineCriticality } from './repo/config.js';
export {
  activeListItems,
  activeMachineByCode,
  listItem,
  machineFamily,
  machinesByIds,
  productionDateAt,
  setting,
  shiftCodeAt,
  shiftsOf,
  shiftWindows,
  type MachineFamily,
  type MachineRow,
} from './repo/reads.js';
export { actorOf, forbidden } from './actor.js';
export { registerResource } from './settings-routes.js';
export { plantToday, type Problem, type Resource } from './settings-resources.js';
export { shiftIsOn } from './repo/plant-settings.js';
export { passwordChangeEnforced } from './service.js';

export const plantModule = defineModule({ name: 'plant', register: registerPlantRoutes });
