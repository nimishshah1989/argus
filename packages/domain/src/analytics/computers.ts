import type { Computer } from './types.js';

/**
 * The computation of each figure, by key. Empty in the shell: a registered figure with no entry here answers
 * `not_computed`. Engine tickets 38 to 45 add their entries from their own files, for example
 * `...dashboardComputers`, and nothing else in the engine changes.
 */
export const COMPUTERS: Readonly<Record<string, Computer>> = {};

/**
 * A count of the machines in the named segments, naming every machine it counted so a drill opens them. A scrapped
 * machine is out of every count: it is no longer on the floor. A machine the plant leaves out of its production
 * data is still fleet and still counted — the answer key's 126 CNC machines hold the one its sub-label marks
 * "1 not counted in production data", and only `status: 'scrapped'` leaves a count.
 */
function countSegments(...segments: readonly string[]): Computer {
  return ({ data }) => {
    const counted = data.machines.filter(
      (machine) =>
        machine.status !== 'scrapped' &&
        machine.segment !== null &&
        segments.includes(machine.segment),
    );
    return { value: counted.length, drillIds: counted.map((machine) => machine.id) };
  };
}

/**
 * Packet 38.0: the six machine counts, segment-driven exactly as the answer key's sub-labels read. Total Machines
 * is "CNC + Conventional + Process" (159 on the workbook); Utilities (30) and DG sets (3) are registers outside
 * the fleet total, the DG sub-label saying it plainly: "power sources — not counted in load".
 *
 * Not joined into `COMPUTERS` yet: packets 38.1 and 38.2 add the rest of the Dashboard's numbers, the charts and
 * the checklist, and the packet that finishes the screen joins the map in.
 */
export const dashboardComputers: Readonly<Record<string, Computer>> = {
  'dashboard.total-machines': countSegments('CNC', 'Conventional', 'Process'),
  'dashboard.utilities': countSegments('Utility'),
  'dashboard.dg-sets': countSegments('DG'),
  'dashboard.cnc-machines': countSegments('CNC'),
  'dashboard.conventional-machines': countSegments('Conventional'),
  'dashboard.process-machines': countSegments('Process'),
};
