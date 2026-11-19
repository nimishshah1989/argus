import { defineModule } from '../../kernel/index.js';
import { registerPlantRoutes } from './routes.js';

export {
  hasShifts,
  removeNudgeAck,
  saveNudgeAck,
  selectNudgeAck,
  selectNudgeAcks,
  setMachineCriticality,
  type StoredSetting,
} from './repo/config.js';
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
export { ensureLockoutSteps } from './lockout.js';
export { ensureFailureCodes, failureCodeIndexOf } from './failure-codes.js';
export {
  ensureSettingRow,
  listsForEngine,
  machinesForEngine,
  movesForEngine,
} from './repo/analytics.js';
export { settingRowStore } from './repo/setting-row.js';
export { actorOf, forbidden } from './actor.js';
export { mayViewBoard } from './board-access.js';
export { registerResource } from './settings-routes.js';
export { plantToday, type Problem, type Resource } from './settings-resources.js';
export { shiftIsOn, type Row, type Store } from './repo/plant-settings.js';
export { passwordChangeEnforced } from './service.js';
export {
  activePlanForMachine,
  assetRegisterById,
  insertAssetRegister,
  insertPmPlan,
  pmPlanById,
  pmPlanForMachine,
  pmPlansForScheduling,
  recordPmCompletion,
  type AssetKind,
  type AssetRegisterInput,
  type AssetRegisterRow,
  type PmPlan,
  type PmPlanDraftInput,
  type PmScheduledPlan,
} from './repo/records.js';

export const plantModule = defineModule({ name: 'plant', register: registerPlantRoutes });
