import { gujarati } from './blank.js';
import { analyticsV2ForecastEn } from './analytics-v2-forecast.en.js';

/** The words the plant reads on these four screens; a key left out shows the English until the next sweep (D7). */
export const analyticsV2ForecastGu = gujarati(analyticsV2ForecastEn, {
  'v2e.title': 'એનર્જી હીટમેપ',
  'v2e.heat.low': 'હળવો લોડ',
  'v2e.heat.high': 'ભારે લોડ',
  'v2b.title': 'બોટલનેક વિશ્લેષણ',
  'v2s.heat.low': 'ઓછા કલાક',
  'v2s.heat.high': 'વધુ કલાક',
  'v2s.heat.none': 'કોઈ કલાક નથી',
});
