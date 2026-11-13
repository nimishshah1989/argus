import { defineModule } from '../../kernel/index.js';
import { registerPush } from './routes.js';

export const notificationsModule = defineModule({ name: 'notifications', register: registerPush });
