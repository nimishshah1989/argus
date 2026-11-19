import {
  contributeConfigPart,
  contributeTicketListener,
  contributeTicketPart,
  defineModule,
  setRosterLookup,
} from '../../kernel/index.js';
import { alertOnTicketWrite } from './alerts.js';
import { escalationTicketPart } from './escalation-state.js';
import { startReopenEscalation } from './escalation.js';
import {
  canAcknowledgeTicketPart,
  handbackTicketPart,
  slaPoliciesPart,
  slaTicketPart,
} from './parts.js';
import { onRosterAt } from './roster.js';
import { registerFailedJobRoutes } from './failed-jobs.js';
import { registerSettings } from './routes.js';
import { registerSignoffFeed } from './signoff-feed.js';

export { startJobs } from './jobs.js';
export { LATE_AFTER_SECONDS, runJobWatch, startJobWatch } from './job-watch.js';
export type { SlaTicketReconciler } from './consistency.js';
export { reconcileSlaPolicies, reconcileTicket } from './sla.js';
export { ensureEscalationDefaults, purgeRoster } from './ladder.js';

export const accountabilityModule = defineModule({
  name: 'accountability',
  register: (app, config) => {
    registerSettings(app, config);
    registerFailedJobRoutes(app, config);
    registerSignoffFeed(app, config.pool);
    contributeTicketPart(slaTicketPart);
    contributeTicketPart(handbackTicketPart);
    contributeTicketPart(canAcknowledgeTicketPart);
    contributeTicketPart(escalationTicketPart);
    contributeConfigPart(slaPoliciesPart);
    contributeTicketListener('alerts', alertOnTicketWrite);
    contributeTicketListener('reopened-escalation', startReopenEscalation);
    setRosterLookup(onRosterAt);
  },
});
