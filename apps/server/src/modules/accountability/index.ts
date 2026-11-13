import { defineModule } from '../../kernel/index.js';
import { registerSettings } from './routes.js';

export { startJobs } from './jobs.js';
export type { SlaTicketReconciler } from './consistency.js';
export { projectTicketSla, withSlaProjections } from './projection.js';
export { loadSlaPolicies } from './repo/policies.js';
export { reconcileSlaPolicies, reconcileTicket } from './sla.js';

export const accountabilityModule = defineModule({
  name: 'accountability',
  register: registerSettings,
});
