import type { Command, TransitionInput, TransitionResult } from '../types.js';
import * as commands from './index.js';

export const handlers: {
  [K in Command['type']]: (
    input: TransitionInput,
    command: Extract<Command, { type: K }>,
  ) => TransitionResult;
} = {
  start: commands.start,
  pause: commands.pause,
  resume: commands.resume,
  transfer: commands.transfer,
  update: commands.update,
  machineRunning: commands.machineRunning,
  machineStopped: commands.machineStopped,
  close: commands.close,
  cancel: commands.cancel,
  join: commands.join,
  leave: commands.leave,
  upgradeKind: commands.upgradeKind,
  lateReport: commands.lateReport,
  restore: commands.restore,
  correct: commands.correct,
  confirmLockout: commands.confirmLockout,
};
