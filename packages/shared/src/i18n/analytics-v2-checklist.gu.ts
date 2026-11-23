import { gujarati } from './blank.js';
import { analyticsV2ChecklistEn } from './analytics-v2-checklist.en.js';

/** The v2 Data Checklist in Gujarati: the short labels now; a sentence left out shows in English until the next sweep. */
export const analyticsV2ChecklistGu = gujarati(analyticsV2ChecklistEn, {
  'v2dc.status.gap': 'ખામી',
  'v2dc.status.check': 'તપાસ',
  'v2dc.owner': 'જવાબદાર',
  'v2dc.records.title': 'સુધારવાના રેકોર્ડ',
  'v2dc.kpi.records.label': 'સુધારવાના રેકોર્ડ',
  'v2dc.records.record': 'રેકોર્ડ',
  'v2dc.records.all': 'બધા',
  'v2dc.days_one': '{{count}} દિવસ',
  'v2dc.days_other': '{{count}} દિવસ',
});
