import type { Computer } from './types.js';

/** A machine younger than this many days since its purchase date is a young machine (ADR 0051, A2). */
export const YOUNG_DAYS = 300;

/** Warranty runs this many years from the purchase date (ADR 0051, A1). */
export const WARRANTY_YEARS = 1;

/**
 * The OEM Analytics figure (ticket 812, ADR 0051): young CNC production machines, their breakdowns against older
 * peers, by make and model, faults that repeat, and every breakdown with the cause a person decided (Not decided when
 * none). No keyword guess and no rupees. No young machine gives `{ value: null, drillIds: [] }`.
 */
export const oemAnalyticsFigure: Computer = () => {
  throw new Error('not implemented');
};
