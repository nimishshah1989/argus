import { gujarati } from './blank.js';
import { statusTicketEn } from './status-ticket.en.js';

export const statusTicketGu = gujarati(statusTicketEn, {
  'status.open': 'ખુલ્લી',
  'status.working': 'કામ ચાલુ',
  'status.waiting': 'રાહમાં',
  'status.closed': 'ક્લોઝ',
  'status.cancelled': 'રદ',
  'status.ticket.stopped': 'બંધ',
  'status.ticket.inProgress': 'કામ ચાલુ',
  'status.ticket.support': 'સપોર્ટ',
  'status.ticket.waiting': 'રાહમાં',
  'status.ticket.transferred': 'સોંપાઈ',
  'status.ticket.running': 'ચાલુ',
  'status.ticket.closed': 'ક્લોઝ',
  'status.ticket.cancelled': 'રદ',
});
