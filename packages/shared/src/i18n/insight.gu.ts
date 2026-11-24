import { gujarati } from './blank.js';
import { insightEn } from './insight.en.js';

/** Insight lines: the same keys, empty until the plant's Gujarati arrives; blank falls back to English (D7). */
export const insightGu = gujarati(insightEn, {});
