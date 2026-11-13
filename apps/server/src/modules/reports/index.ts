import { defineModule } from '../../kernel/index.js';
import { registerReports } from './routes.js';

export const reportsModule = defineModule({ name: 'reports', register: registerReports });
