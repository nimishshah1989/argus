import { gujarati } from './blank.js';
import { plantEn } from './plant.en.js';

export const plantGu = gujarati(plantEn, {
  'plant.machines.production.intro':
    'તેના બ્રેકડાઉન નોંધાયેલા રહે છે અને મેનપાવર કલાકો તથા એનર્જી યાદીમાં ગણાય છે, પરંતુ બ્રેકડાઉન %, એમટીટીઆર, એમટીબીએફ કે ઉપલબ્ધતામાં નહીં',
  'plant.machines.production.switch': 'પ્રોડક્શન ડેટામાં ગણવામાં આવતું નથી',
  'plant.machines.production.switchFor': 'પ્રોડક્શન ડેટામાં ગણવામાં આવતું નથી: {{name}}',
  'plant.machines.production.tag': 'પ્રોડક્શન ડેટામાં નથી',
  'plant.machines.production.count': '{{count}} મશીન ગણાતા નથી',
  'plant.machines.production.count_one': '1 મશીન ગણાતું નથી',
  'plant.machines.production.count_other': '{{count}} મશીન ગણાતા નથી',
  'plant.machines.production.error':
    '{{name}} સાચવી શકાયું નહીં. સ્વિચ પહેલાં જેવી જ છે; ફરી પ્રયત્ન કરો.',
  'plant.machines.production.column': 'પ્રોડક્શન ડેટા',
});
