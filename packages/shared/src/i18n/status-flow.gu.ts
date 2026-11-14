import { gujarati } from './blank.js';
import { statusFlowEn } from './status-flow.en.js';

export const statusFlowGu = gujarati(statusFlowEn, {
  'status.handback.requested': 'મંજૂરી માંગી',
  'status.handback.confirmed': 'મંજૂર',
  'status.handback.disputed': 'વાંધો',
  'status.handback.timedOut': 'સમય પૂરો',
  'status.pm.due': 'કરવાનું છે',
  'status.pm.overdue': 'મોડું',
  'status.pm.done': 'પૂરું',
  'status.sync.online': 'ઓનલાઇન',
  'status.sync.offline': 'ઓફલાઇન',
  'status.sync.sending': 'મોકલાય છે',
  'status.sync.draft': 'ડ્રાફ્ટ',
});
