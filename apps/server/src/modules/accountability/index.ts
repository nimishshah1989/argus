import {
  contributeConfigPart,
  contributeTicketListener,
  contributeTicketPart,
  defineModule,
  setRosterLookup,
} from '../../kernel/index.js';
import { alertOnTicketWrite } from './alerts.js';
import { startReopenEscalation } from './escalation.js';
import {
  canAcknowledgeTicketPart,
  handbackTicketPart,
  slaPoliciesPart,
  slaTicketPart,
} from './parts.js';
import { onRosterAt } from './roster.js';
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
    contributeTicketPart(handbackTicketPart);
    contributeTicketPart(canAcknowledgeTicketPart);
    contributeConfigPart(slaPoliciesPart);
    contributeTicketListener('alerts', alertOnTicketWrite);
    contributeTicketListener('reopened-escalation', startReopenEscalation);
    setRosterLookup(onRosterAt);
  },
});
