import { gujarati } from './blank.js';
import { analyticsGuideEn } from './analytics-guide.en.js';

/** The Guide's entries wait for the native reader (N5); the page's own heading is translated. */
export const analyticsGuideGu = gujarati(analyticsGuideEn, {
  'analytics.guide.heading': 'દરેક આંકડા પાછળનો નિયમ',
  'analytics.guide.all': 'બધા',
  'analytics.guide.unbuilt': 'હજી બન્યું નથી',
  'analytics.guide.group.basics': 'મૂળભૂત',
  'analytics.guide.group.overview': 'ઝાંખી',
  'analytics.guide.group.reliability': 'વિશ્વસનીયતા',
  'analytics.guide.group.problems': 'સમસ્યાઓ',
  'analytics.guide.group.machines': 'મશીનો',
  'analytics.guide.group.people-money': 'લોકો અને પૈસા',
  'analytics.guide.group.reports-data': 'રિપોર્ટ અને ડેટા',
  'analytics.guide.group.planning': 'આયોજન',
  'analytics.guide.takeaway':
    '{{group}} માં સૌથી વધુ છે ({{total}} માંથી {{n}}). {{unbuilt}} "હજી બન્યું નથી" તરીકે ચિહ્નિત છે.',
});
