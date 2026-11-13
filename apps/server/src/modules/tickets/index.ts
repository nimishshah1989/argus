import { defineModule } from '../../kernel/index.js';
import { registerTags } from './tags.js';
import { registerTickets } from './routes.js';

export { figuresFromRow } from './mapper.js';
export { loadEvents, lockRefCounter, reviveCorrection } from './repo/ticket.js';
export { loadReport, type StoredReport } from './repo/report.js';
export { loadSeverityMatrix } from './severity.js';

export const ticketsModule = defineModule({
  name: 'tickets',
  register: (app, config) => {
    registerTickets(app, config);
    registerTags(app, config);
  },
});
