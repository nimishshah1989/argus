import { defineModule } from '../../kernel/index.js';
import { registerTags } from './tags.js';
import { registerTickets } from './routes.js';

export { figuresFromRow } from './mapper.js';
export { loadEvents, lockRefCounter, reviveCorrection } from './repo/ticket.js';
export { loadReport, type StoredReport } from './repo/report.js';
export { loadSeverityMatrix, refreshMachineSeverity } from './severity.js';
export {
  lockTicket,
  setSlaPolicyId,
  slaCandidateIds,
  slaConsistencyIds,
  slaTicketRows,
  ticketEventRows,
  type SlaTicketRow,
} from './repo/sla.js';

export const ticketsModule = defineModule({
  name: 'tickets',
  register: (app, config) => {
    registerTickets(app, config);
    registerTags(app, config);
  },
});
export { dayJobRows, pdfTicketRow, pendingRows, setReportPdf } from './repo/history.js';
export {
  deleteImportedTickets,
  importedChildren,
  importedTicketRows,
  insertImportedCrew,
  insertImportedEvent,
  insertImportedReport,
  insertImportedSegment,
  insertImportedTicket,
  insertReportPerson,
  outsideChildRef,
  raiseRefCounter,
  refCounterRows,
  refsByIds,
  reportWithFileId,
  setParent,
  ticketParents,
  ticketRefsLike,
} from './repo/imported.js';
export { initRefCounters } from './repo/seed.js';
