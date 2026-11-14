import {
  contributeConfigPart,
  contributeTicketListener,
  contributeTicketPart,
  defineModule,
} from '../../kernel/index.js';
import { alertOnTicketWrite } from './alerts.js';
import { slaPoliciesPart, slaTicketPart } from './parts.js';
import { registerSettings } from './routes.js';

export { startJobs } from './jobs.js';
export type { SlaTicketReconciler } from './consistency.js';
export { reconcileSlaPolicies, reconcileTicket } from './sla.js';
export { ensureEscalationDefaults, purgeRoster } from './ladder.js';

export const accountabilityModule = defineModule({
  name: 'accountability',
  register: (app, config) => {
    registerSettings(app, config);
    contributeTicketPart(slaTicketPart);
    contributeConfigPart(slaPoliciesPart);
    contributeTicketListener('alerts', alertOnTicketWrite);
  },
});
