import { defineModule } from '../../kernel/index.js';
import { registerPlantRoutes } from './routes.js';

export { hasShifts, setMachineCriticality } from './repo/config.js';
export {
  activeListItems,
  activeMachineByCode,
  listItem,
  lockoutFlagged,
  lockoutSteps,
  machineFamily,
  machinesByIds,
  offBoardMachineIds,
  productionDateAt,
  setting,
  shiftCodeAt,
  shiftNowAt,
  shiftsOf,
  shiftWindows,
  type MachineFamily,
  type ShiftNow,
  type MachineRow,
} from './repo/reads.js';
export { actorOf, forbidden } from './actor.js';
export { registerResource } from './settings-routes.js';
export { plantToday, type Problem, type Resource } from './settings-resources.js';
export { shiftIsOn, type Row, type Store } from './repo/plant-settings.js';
export { passwordChangeEnforced } from './service.js';

export const plantModule = defineModule({ name: 'plant', register: registerPlantRoutes });
