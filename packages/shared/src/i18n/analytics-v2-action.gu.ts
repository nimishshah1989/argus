import { gujarati } from './blank.js';
import { analyticsV2ActionEn } from './analytics-v2-action.en.js';

/** The v2 Action Center in Gujarati; terms follow docs/design/gujarati-glossary.md and v1's own Action Center words. */
export const analyticsV2ActionGu = gujarati(analyticsV2ActionEn, {
  'v2a.table.title': 'યાદ અપાવણીઓ',
  'v2a.col.priority': 'પ્રાથમિકતા',
  'v2a.col.nudge': 'યાદ અપાવણી',
  'v2a.col.entries': 'એન્ટ્રી',
  'v2a.col.latest': 'છેલ્લી એન્ટ્રી',
  'v2a.col.status': 'સ્થિતિ',
  'v2a.kpi.none': 'કંઈ ખુલ્લું નથી',
  'v2a.kpi.low': 'આના પર નજર રાખો',
  'v2a.kpi.info': 'સારા સમાચાર, કંઈ કરવાનું નથી',
  'v2a.kpi.more':
    'ફક્ત ખુલ્લી યાદ અપાવણીઓ ગણાય છે. સ્વીકારેલી, મુલતવી અને ઉકેલાયેલી નીચે પોતાના ટૅબમાં છે.',
  'v2a.verdict.calm': '{n} યાદ અપાવણીઓ ખુલ્લી છે, એકેય તાત્કાલિક નથી.',
  'v2a.why.top': ' સૌથી પહેલા ધ્યાન માંગે છે, સ્કોર {score}: {why}.',
  'v2a.why.scope':
    'દરેક યાદ અપાવણી બ્રેકડાઉન લૉગ, PM એન્ટ્રી, મશીન અને ટીમ પરથી પ્લાન્ટની પોતાની મર્યાદાઓ સામે કાઢવામાં આવે છે. સ્વીકારેલી, મુલતવી અને ઉકેલાયેલી ઉપરની ગણતરીમાંથી નીકળી જાય છે.',
  'v2a.detail.about': 'તેની પાછળ શું છે',
  'v2a.detail.stored': 'શું નોંધાયું છે',
  'v2a.detail.actions': 'શું કરવું',
  'v2a.detail.machines': 'મશીન',
  'v2a.owner.none': 'કોઈ જવાબદાર નથી',
  'v2a.saved': 'તાજું કરી શકાયું નહીં. છેલ્લો જવાબ બતાવી રહ્યા છીએ.',
});
