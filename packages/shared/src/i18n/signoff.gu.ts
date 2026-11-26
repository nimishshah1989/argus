import { gujarati } from './blank.js';
import { signoffEn } from './signoff.en.js';

export const signoffGu = gujarati(signoffEn, {
  'signoff.deskOutcomes': 'છેલ્લા 24 કલાકમાં જવાબ',
  'signoff.deskDisputedCount':
    'છેલ્લા 24 કલાકમાં {{count}} પાછા મોકલ્યા. વિવાદો એસ્કેલેશનમાં ગણાય છે.',
  'signoff.deskConfirmed': 'ઠીક થયાની પુષ્ટિ',
  'signoff.deskConfirmedSub': '{{who}}, {{time}} વાગ્યે · બંધ થયા પછી {{after}}',
  'signoff.deskDisputed': 'વિવાદ, ફરી ખોલ્યું',
  'signoff.deskDisputedSub': '{{who}}, {{time}} વાગ્યે: "{{reason}}"',
  'signoff.deskTimedOut': 'જવાબ નથી',
  'signoff.deskTimedOutSub':
    '{{limit}} માં જવાબ નથી, તેથી બંધ રહે છે. કોને જાણ કરવી તે એસ્કેલેશન નિયમ નક્કી કરે છે.',
});
