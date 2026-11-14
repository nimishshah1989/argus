import { defineModule, setMachineSwitchOffCheck } from '../../kernel/index.js';
import { activeTicketId } from './repo/list.js';
import { registerTickets } from './routes.js';

export { figuresFromRow } from './mapper.js';
export { figureDrift, type DriftLine } from './drift.js';
export { purgeIdempotencyKeys } from './repo/idempotency.js';
export { loadEvents, lockRefCounter, reviveCorrection } from './repo/ticket.js';
export { loadReport, type StoredReport } from './repo/report.js';
export { activeTicketRefsOfPerson } from './repo/people.js';
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
    // A machine with a breakdown or support ticket still open cannot be switched off: its tile would leave the board.
    setMachineSwitchOffCheck(async (client, tenantId, machineId) =>
      (await activeTicketId(client, tenantId, machineId))
        ? 'This machine has an open ticket; close or cancel it first'
        : null,
    );
    registerTickets(app, config);
  },
});
export {
  dayJobRows,
  machineHistory,
  notesSeenElsewhere,
  pdfTicketRow,
  pendingRows,
  peopleWhoWorked,
  type HistoryRow,
  type StateAtEnd,
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
export { countTickets, initRefCounters } from './repo/seed.js';
export { importTickets, type ImportedTicketRow } from './import.js';
