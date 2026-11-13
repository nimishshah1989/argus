import { defineModule } from '../../kernel/index.js';
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
  },
});
export {
  dayJobRows,
  machineHistory,
  notesSeenElsewhere,
  pdfTicketRow,
  pendingRows,
  setReportPdf,
  type HistoryRow,
} from './repo/history.js';
export {
  importedChildren,
  importedTicketRows,
  insertImportedCrew,
  insertImportedEvent,
  insertImportedReport,
  insertImportedSegment,
  insertImportedTicket,
  insertReportPerson,
  raiseRefCounter,
  removeImported,
  refCounterRows,
  refsByIds,
  setParent,
  ticketParents,
  ticketRefsLike,
} from './repo/imported.js';
export { initRefCounters } from './repo/seed.js';
export { importTickets, type ImportedTicketRow } from './import.js';
