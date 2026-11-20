import { gujarati } from './blank.js';
import { analyticsV2TodayEn } from './analytics-v2-today.en.js';

/** The v2 Today section: the same keys, empty until the plant's Gujarati arrives; blank falls back to English (D7). */
export const analyticsV2TodayGu = gujarati(analyticsV2TodayEn, {});
