import { gujarati } from './blank.js';
import { analyticsMachinesEn } from './analytics-machines.en.js';

export const analyticsMachinesGu = gujarati(analyticsMachinesEn, {
  'analytics.excludedMachines': '{{count}} મશીન પ્રોડક્શન ડેટામાં ગણાતા નથી',
  'analytics.excludedMachines_one': '1 મશીન પ્રોડક્શન ડેટામાં ગણાતું નથી',
  'analytics.excludedMachines_other': '{{count}} મશીન પ્રોડક્શન ડેટામાં ગણાતા નથી',
});
