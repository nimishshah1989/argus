import { gujarati } from './blank.js';
import { slaEn } from './sla.en.js';

export const slaGu = gujarati(slaEn, {
  'sla.title': 'SLA ટાઇમર',
  'sla.ack': 'સ્વીકાર',
  'sla.restore': 'રિસ્ટોર',
  'sla.notConfigured': 'SLA સેટ નથી.',
  'sla.unavailable': 'આ ઓફલાઇન કૉપીમાં SLA સ્થિતિ મળતી નથી.',
  'sla.notApplicable': 'લાગુ નથી',
  'sla.remaining': '{{time}} બાકી',
  'sla.overdue': '{{time}} મોડું',
  'sla.paused': 'થોભાવેલું · {{time}} બાકી',
  'sla.pausedOverdue': 'થોભાવેલું · {{time}} મોડું',
  'sla.stoppedLeft': 'અટક્યું · {{time}} બાકી',
  'sla.stoppedLate': 'અટક્યું · {{time}} મોડું',
  'sla.due': 'છેલ્લો સમય',
  'sla.stoppedAt': 'અટક્યાનો સમય',
  'sla.dueAfterResume': 'ફરી શરૂ થાય ત્યારે છેલ્લો સમય ફરી ગણાશે',
  'sla.cancelledRestore': 'ટિકિટ રદ થઈ; પાછી લાવશો તો ઘડિયાળ ફરી ગણાશે.',
  'sla.acknowledgedBy': '{{who}} દ્વારા સ્વીકાર્યું · {{time}}',
  'action.label.acknowledge': 'સ્વીકારો',
  'escalation.cardWaiting': 'એસ્કેલેશન · {{level}} બાકી',
  'escalation.cardTold': 'એસ્કેલેશન · {{level}} જણાવ્યું',
});
