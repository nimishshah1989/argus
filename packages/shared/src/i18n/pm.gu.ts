import { gujarati } from './blank.js';
import { pmEn } from './pm.en.js';

export const pmGu = gujarati(pmEn, {
  'pm.tasks.title': 'કામો',
  'pm.tasks.asOf': '{{date}} સુધીનું લાઇવ',
  'pm.tasks.open': 'ખુલ્લાં કામો',
  'pm.tasks.pm': 'પીએમ કામો',
  'pm.tasks.openEmpty': 'કોઈ ખુલ્લું કામ નથી.',
  'pm.tasks.pmEmpty': 'કોઈ પીએમ કામ નથી.',
  'pm.tasks.scheduled': '{{date}} માટે નક્કી',
  'pm.tasks.loading': 'કામો લોડ થઈ રહ્યાં છે…',
  'pm.tasks.unavailable': 'કામો હમણાં ઉપલબ્ધ નથી.',
});
