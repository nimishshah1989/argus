import { gujarati } from './blank.js';
import { settingsEn } from './settings.en.js';

export const settingsGu = gujarati(settingsEn, {
  'settings.title': 'સેટિંગ્સ',
  'settings.back': 'ડેસ્ક પર પાછા',
  'settings.criticalityTitle': 'મશીનનું મહત્વ',
  'settings.criticalityHelp':
    'મહત્વ પરથી ટિકિટની ગંભીરતા નક્કી થાય છે: A મશીન બંધ થાય તો પ્રોડક્શન અટકે, C મશીન સૌથી ઓછાં મહત્વનાં છે.',
  'settings.criticalityNone': 'નક્કી નથી',
  'settings.criticalityFor': '{{code}} નું મહત્વ',
  'settings.matrixTitle': 'ગંભીરતા મેટ્રિક્સ',
  'settings.matrixHelp':
    'ટિકિટ નોંધાય ત્યારે મશીનના મહત્વ અને ટિકિટના પ્રકાર પરથી ગંભીરતા નક્કી થાય છે. કામની વિનંતીમાં તેના બદલે અર્જન્ટની નિશાની વપરાય છે.',
  'settings.matrixCriticality': 'મહત્વ',
  'settings.matrixStopped': 'મશીન બંધ',
  'settings.matrixSupport': 'સપોર્ટ',
  'settings.matrixCell': '{{criticality}} {{kind}} ગંભીરતા',
  'settings.matrixWorkRequest': 'કામની વિનંતી',
  'settings.matrixUrgentWorkRequest': 'અર્જન્ટ કામની વિનંતી',
  'settings.saveMatrix': 'મેટ્રિક્સ સેવ કરો',
  'settings.saved': 'સેવ થયું',
  'settings.saveFailed': 'સેવ ન થયું. ફરી પ્રયાસ કરો.',
  'settings.loading': 'સેટિંગ્સ લોડ થાય છે…',
  'settings.loadFailed': 'સેટિંગ્સ લોડ ન થયાં. ફરી પ્રયાસ કરો.',
  'settings.forbiddenTitle': 'સેટિંગ્સની પરવાનગી નથી',
  'settings.forbiddenHelp': 'મશીનનું મહત્વ કે ગંભીરતા મેટ્રિક્સ બદલવા એડમિન કે હેડને કહો.',
  'settings.offline': 'ઓફલાઇન: સેટિંગ્સ ફક્ત જોઈ શકાય છે. ફેરફાર કરવા ફરી કનેક્ટ થાઓ.',
  'settings.forbiddenSlaHelp':
    'SLA પોલિસી અને રિસ્ટોર ઘડિયાળના રાહ નિયમો માટે પણ આ જ પરવાનગી જોઈએ.',
  'settings.slaTitle': 'SLA પોલિસી',
  'settings.slaHelp':
    'દરેક ગંભીરતા માટે સ્વીકાર અને રિસ્ટોરનો ટાર્ગેટ નક્કી કરો. કામના કલાકો સેટ કરેલી શિફ્ટ પ્રમાણે ગણાય છે.',
  'settings.slaEmpty': 'કોઈ SLA પોલિસી સેટ નથી. ચારેય ટાર્ગેટ લખીને સેવ કરો.',
  'settings.slaUnavailable': 'આ ઓફલાઇન કૉપીમાં SLA સેટિંગ્સ મળતાં નથી.',
  'settings.slaAckMinutes': 'સ્વીકાર મિનિટ',
  'settings.slaRestoreMinutes': 'રિસ્ટોર મિનિટ',
  'settings.slaBusinessHours': 'ફક્ત કામના કલાકો',
  'settings.slaSave': 'SLA પોલિસી સેવ કરો',
  'settings.slaSaved': 'SLA પોલિસી સેવ થઈ',
  'settings.slaSaveFailed': 'SLA પોલિસી સેવ ન થઈ. તમારા ફેરફાર હજી અહીં છે. ફરી પ્રયાસ કરો.',
  'settings.waitSlaTitle': 'રિસ્ટોર ઘડિયાળ થોભાવવી',
  'settings.waitSlaHelp':
    'આ ફેરફાર પછી શરૂ થતી રાહ પર લાગુ થશે. ચાલુ રાહ જે નિયમથી શરૂ થઈ તે જ નિયમ રાખશે.',
  'settings.waitSlaFor': '{{label}} ની રાહ દરમિયાન રિસ્ટોર ઘડિયાળ થોભાવો',
  'settings.waitSlaEmpty': 'રાહનાં કોઈ કારણ સેટ નથી.',
  'settings.waitSlaSaved': 'રાહ નિયમ સેવ થયો',
  'settings.waitSlaSaveFailed': 'રાહ નિયમ સેવ ન થયો. ફરી પ્રયાસ કરો.',
});
