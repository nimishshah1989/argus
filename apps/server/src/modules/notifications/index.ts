import { defineModule } from '../../kernel/index.js';
import { registerPush } from './routes.js';

export { clearSubscriptionPerson, deleteSubscriptionsOf, purgeNotifications } from './repo.js';
export { KINDS, type NotifyKind } from './kinds.js';
export { NOTIFY_SEND_QUEUE, notify, type Notified, type NotifyInput } from './notify.js';
export { processNotification, type SendDeps, type SendResult } from './send.js';
export { startNotifyJobs, type NotifyJobDeps } from './jobs.js';
export type { Channel } from './repo.js';

export const notificationsModule = defineModule({ name: 'notifications', register: registerPush });
