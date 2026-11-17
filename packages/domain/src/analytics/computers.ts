import type { Computer } from './types.js';

/**
 * The computation of each figure, by key. Empty in the shell: a registered figure with no entry here answers
 * `not_computed`. Engine tickets 38 to 45 add their entries from their own files, for example
 * `...dashboardComputers`, and nothing else in the engine changes.
 */
export const COMPUTERS: Readonly<Record<string, Computer>> = {};

/**
 * A count of the machines in the named workbook lists, naming every machine it counted so a drill opens them. The
 * fixture carries each list as its segment (the rows of a list carry no segment of their own), so the count is
 * list-driven: it counts what the list holds, and excludes nothing by status or by a settings exclusion.
 */
function countSegments(...segments: readonly string[]): Computer {
  return ({ data }) => {
    const counted = data.machines.filter(
      (machine) => machine.segment !== null && segments.includes(machine.segment),
    );
    return { value: counted.length, drillIds: counted.map((machine) => machine.id) };
  };
}

/**
 * Packet 38.0: the six machine counts, from the workbook's own lists. Total Machines is the three production lists,
 * 126 + 16 + 17 = 159; Utilities (30) and DG sets (3) are registers outside the fleet total, the DG sub-label saying
 * it plainly: "power sources — not counted in load". The CNC list holds the machine its sub-label marks "1 not
 * counted in production data": that exclusion is production-only (the breakdown-free card divides by 125), the
 * machine is still fleet, and it is counted here.
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
