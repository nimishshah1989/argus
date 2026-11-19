import { gujarati } from './blank.js';
import { analyticsCompareEn } from './analytics-compare.en.js';

export const analyticsCompareGu = gujarati(analyticsCompareEn, {
  'analytics.unit.points': 'પૉઇન્ટ',
  'analytics.today.vs': 'ફેરફાર {{date}} સાથે સરખાવ્યો છે, {{days}} દિવસ પહેલાંની તારીખ',
  'analytics.today.rowsFor': '{{figure}} પાછળની હરોળો જુઓ',
  'analytics.today.added': '{{days}} દિવસમાં {{amount}}',
  'analytics.today.costliest.line_one': '{{hours}} · {{share}} · {{count}} બ્રેકડાઉન',
  'analytics.today.costliest.line_other': '{{hours}} · {{share}} · {{count}} બ્રેકડાઉન',
});
