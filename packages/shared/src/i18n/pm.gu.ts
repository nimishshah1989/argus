import { gujarati } from './blank.js';
import { pmEn } from './pm.en.js';

export const pmGu = gujarati(pmEn, {
  'pm.calendar.moveDate': 'તારીખ પર ખસેડો',
  'pm.calendar.moveDateFor': 'તારીખ પર ખસેડો, {{machine}}',
  'pm.calendar.moveSheet.title': '{{machine}} ને તારીખ પર ખસેડો',
  'pm.calendar.moveSheet.now': 'હાલ {{date}} માટે નક્કી.',
  'pm.calendar.moveSheet.label': 'નવી તારીખ',
  'pm.calendar.moveSheet.confirm': 'કામ ખસેડો',
  'pm.calendar.jobs.title': 'આ મહિનાનાં કામો',
  'pm.calendar.jobs.hint':
    'આ મહિનાનું જે PM કામ હજી ખસેડી શકાય તેમ છે તે અહીં છે: તારીખ પર ખસેડો પસંદ કરો, દિવસ લખો અને એન્ટર દબાવો.',
  'pm.calendar.moveTo': '{{date}} પર ખસેડો',
  'pm.calendar.suggested': 'સૌથી નજીકનો ખાલી દિવસ {{date}}',
  'pm.calendar.noFreeDay': 'તેની મર્યાદામાં કોઈ ખાલી દિવસ નથી.',
  'pm.calendar.moved': '{{machine}} ને {{date}} પર ખસેડ્યું.',
  'pm.calendar.refused': 'ખસેડવાની વિનંતી નકારવામાં આવી.',
  'pm.tasks.title': 'કામો',
  'pm.tasks.asOf': '{{date}} સુધીનું લાઇવ',
  'pm.tasks.open': 'ખુલ્લાં કામો',
  'pm.tasks.pm': 'PM કામો',
  'pm.tasks.openEmpty': 'કોઈ ખુલ્લું કામ નથી.',
  'pm.tasks.pmEmpty': 'કોઈ PM કામ નથી.',
  'pm.tasks.scheduled': '{{date}} માટે નક્કી',
  'pm.tasks.loading': 'કામો લોડ થઈ રહ્યાં છે…',
  'pm.tasks.unavailable': 'કામો હમણાં ઉપલબ્ધ નથી.',
});
