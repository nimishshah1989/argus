import { gujarati } from './blank.js';
import { analyticsV2MachinesEn } from './analytics-v2-machines.en.js';

/** The v2 Machines section: the same keys, empty until the plant's Gujarati arrives; blank falls back to English (D7). */
export const analyticsV2MachinesGu = gujarati(analyticsV2MachinesEn, {
  'v2m.savedCopy': 'તમે ઓફલાઇન છો. આ આંકડા {date} ના રોજ સાચવેલી નકલના છે.',
  'v2m.savedAfterCorrection':
    'તમારો સુધારો સાચવાયો છે. તમે ઓફલાઇન છો, તેથી આ યાદી હજી {date} ના રોજ સાચવેલી નકલ છે અને જૂની તારીખ બતાવે છે.',
  'v2m.refused': 'તમારા લૉગિનથી આ પાનું ખુલી શકતું નથી. મેન્ટેનન્સ હેડ પાસે પરવાનગી માગો.',
});
