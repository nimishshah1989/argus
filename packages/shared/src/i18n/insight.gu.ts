import { gujarati } from './blank.js';
import { insightEn } from './insight.en.js';

/** Insight lines: the same keys, empty until the plant's Gujarati arrives; blank falls back to English (D7). */
export const insightGu = gujarati(insightEn, {
  'insight.years.label': 'ડેટાનાં વર્ષ',
  'insight.years.default': 'આ વર્ષ (વલણ માટે બધાં વર્ષ)',
  'insight.years.all': 'બધાં વર્ષ',
  'insight.years.asOf':
    'આ પાનું પ્લાન્ટ તે દિવસે જેવો છે તે બતાવે છે; પસંદ કરેલાં વર્ષથી તે બદલાતું નથી.',
  'insight.years.history':
    'આ પાનું જાણી જોઈને દરેક નોંધાયેલા વર્ષમાંથી શીખે છે; પસંદ કરેલાં વર્ષથી તે બદલાતું નથી.',
});
