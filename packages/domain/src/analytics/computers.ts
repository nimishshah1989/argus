import type { Computer } from './types.js';

/**
 * The computation of each figure, by key. Empty in the shell: a registered figure with no entry here answers
 * `not_computed`. Engine tickets 38 to 45 add their entries from their own files, for example
 * `...dashboardComputers`, and nothing else in the engine changes.
 */
export const COMPUTERS: Readonly<Record<string, Computer>> = {};
