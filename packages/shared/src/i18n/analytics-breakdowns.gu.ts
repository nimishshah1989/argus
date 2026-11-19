import { gujarati } from './blank.js';
import { analyticsBreakdownsEn } from './analytics-breakdowns.en.js';

export const analyticsBreakdownsGu = gujarati(analyticsBreakdownsEn, {
  'analytics.breakdowns.nav': 'બ્રેકડાઉન સ્ક્રીનો',
  'analytics.screen.shift-kpis': 'શિફ્ટ-કૅલેન્ડર KPI',
  'analytics.figure.shift-kpis.compare': 'પ્લેટફોર્મનો આધાર અને કામકાજના કલાકનો આધાર સાથે સાથે',
  'analytics.figure.shift-kpis.shift-split': 'શિફ્ટ મુજબ બ્રેકડાઉન, કલાક અને MTTR',
  'analytics.figure.shift-kpis.backlog': 'ખુલ્લાં બ્રેકડાઉન, કામકાજના કલાકમાં ઉંમર સાથે',
  'analytics.figure.shift-kpis.breakdown-map': 'મશીન, સેલ, કોડ અને શિફ્ટ મુજબ પેરેટો અને હીટ ગ્રિડ',
  'analytics.log.intro':
    'પ્લાન્ટે નોંધેલી દરેક બ્રેકડાઉન અને PM એન્ટ્રી, સૌથી નવી પહેલાં. લૉગમાં PM હરોળો રહે છે; વિશ્લેષણમાં તે બાકાત છે. NO DT એન્ટ્રીમાં શૂન્ય કલાકને બદલે ડેશ છપાય છે.',
  'analytics.log.filter.title': 'લૉગ ફિલ્ટર કરો',
  'analytics.log.filter.date': 'તારીખ',
  'analytics.log.filter.shift': 'શિફ્ટ',
  'analytics.log.filter.machine': 'મશીન',
  'analytics.log.filter.code': 'કોડ',
  'analytics.log.filter.all': 'બધા',
  'analytics.log.rows': '{{rows}} હરોળ',
  'analytics.log.truncated': '{{total}} માંથી સૌથી નવી {{shown}} બતાવી છે',
  'analytics.log.matching': '{{matching}} આ ફિલ્ટરને બંધબેસે છે',
  'analytics.log.noMatches': 'આ ફિલ્ટરને બંધબેસતી કોઈ હરોળ નથી.',
  'analytics.log.export': 'CSV માં એક્સપોર્ટ કરો',
  'analytics.log.exportError': 'બ્રેકડાઉન લૉગ એક્સપોર્ટ થઈ શક્યો નહીં.',
  'analytics.log.openTicket': 'ક્રમ નં. {{srNo}} ની ટિકિટ ખોલો',
  'analytics.log.empty': 'હજી કોઈ બ્રેકડાઉન લૉગ એન્ટ્રી નથી.',
  'analytics.page.drillTooMany':
    'આ પાના પાછળ {{tickets}} ટિકિટ છે; તેમને બ્રેકડાઉન લૉગમાં એક પછી એક ખોલો.',
  'analytics.page.openLog': 'બ્રેકડાઉન લૉગ ખોલો',
});
