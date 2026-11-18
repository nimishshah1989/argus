import { defineModule } from '../../kernel/index.js';
import { registerPush } from './routes.js';

export {
  clearSubscriptionPerson,
  deleteSubscriptionsOf,
  purgeNotifications,
  toldByEscalationStep,
} from './repo.js';
export { KINDS, type NotifyKind } from './kinds.js';
export {
  NOTIFY_SEND_QUEUE,
  notify,
  type Notified,
  type NotifyInput,
  type SendJob,
} from './notify.js';
export { processNotification, type SendDeps, type SendResult } from './send.js';
export { startNotifyJobs, type NotifyJobDeps } from './jobs.js';
export {
  REGISTER_DUE_QUEUE,
  runRegisterDue,
  startRegisterJobs,
  type RegisterDueDeps,
  type RegisterDueResult,
  type RegisterJobDeps,
} from './register-jobs.js';
export { sweepNotifications, type SweepResult } from './sweep.js';
export type { Channel } from './repo.js';

export const notificationsModule = defineModule({ name: 'notifications', register: registerPush });
