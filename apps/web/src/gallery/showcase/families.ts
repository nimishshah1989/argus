import type { MetricId } from './data.js';

/** The four identity accents (ticket 80u); each is a `--color-family-<name>` token set in `ui/tokens.css`. */
export type Family = 'availability' | 'downtime' | 'repairs' | 'planned';

/** Which family each figure belongs to: how much runs (green), what is lost (orange), repairs (blue), planned work (teal). */
export const FAMILY: Record<MetricId, Family> = {
  availability: 'availability',
  mtbf: 'availability',
  downtime: 'downtime',
  breakdowns: 'downtime',
  mttr: 'repairs',
  pm: 'planned',
};
