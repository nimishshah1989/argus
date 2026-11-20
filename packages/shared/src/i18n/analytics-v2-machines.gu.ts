import { gujarati } from './blank.js';
import { analyticsV2MachinesEn } from './analytics-v2-machines.en.js';

/** The v2 Machines section: the same keys, empty until the plant's Gujarati arrives; blank falls back to English (D7). */
export const analyticsV2MachinesGu = gujarati(analyticsV2MachinesEn, {
  'v2m.refused': 'તમારા લૉગિનથી આ પાનું ખુલી શકતું નથી. મેન્ટેનન્સ હેડ પાસે પરવાનગી માગો.',
});
