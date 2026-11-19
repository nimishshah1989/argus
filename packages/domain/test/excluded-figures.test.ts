import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { run, type EngineData } from '../src/index.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { ENGINE_DATA } from './answer-key/fixture.js';

/**
 * Ticket 77a's audit of the 51 figures: which of them read the production machines (a machine the plant leaves out
 * of production data changes them) and which read every machine (it does not). The three busiest production machines
 * of the 11 November plant are named in the settings list only, so the list alone must be enough to leave them out.
 * A figure that moves between the two lists is a decision, so it changes this test on purpose.
 */

const AS_OF = '2026-11-11';

const READ_THE_PRODUCTION_MACHINES = [
  'a1-bd-pm',
  'a10-problems',
  'a2-category-cell',
  'a3-mttr-mtbf',
  'a6-why-why',
  'a7-footprint',
  'a8-age',
  'a9-bottleneck-forecast',
  'action-center',
  'annual-report',
  'compare',
  'dashboard.avg-bd-hours-per-day',
  'dashboard.avg-complaints-per-day',
  'dashboard.breakdown-free',
  'dashboard.bubble-chart',
  'dashboard.costliest-problems',
  'dashboard.fleet-availability',
  'dashboard.plant-bd-pct',
  'dashboard.total-breakdowns',
  'fix-finder',
  'forecast-lab',
  'machine-page',
  'monthly-report',
  'money-matters',
  'registers',
  'reliability',
  'shift-kpis.breakdown-map',
  'shift-kpis.compare',
  'shift-kpis.shift-split',
  'team-focus',
];

/** The totals, the logs, the machine counts, the PM calendar, and (77a) manpower hours and the energy list. */
const READ_EVERY_MACHINE = [
  'a4-manpower',
  'a5-energy',
  'breakdown-log',
  'cell-change-log',
  'dashboard.avg-bd-hours-per-machine',
  'dashboard.cnc-machines',
  'dashboard.conventional-machines',
  'dashboard.dg-sets',
  'dashboard.expansion-timeline',
  'dashboard.no-downtime-hours',
  'dashboard.pm-hours',
  'dashboard.process-machines',
  'dashboard.total-downtime-hours',
  'dashboard.total-machines',
  'dashboard.utilities',
  'data-checklist',
  'pm-compliance',
  'shift-kpis.backlog',
];

/** Registered, and not computed by any engine yet: they read nothing, so the flag cannot move them. */
const NOT_COMPUTED = ['action-center.spares-spend', 'compare.spares-cost', 'team-focus.cost'];

describe('the 51 figures and the machines left out of production data', () => {
  const busiest = ENGINE_DATA.machines
    .filter(isProduction)
    .map((machine) => ({
      id: machine.id,
      rows: ENGINE_DATA.reports.filter((entry) => entry.machineId === machine.id).length,
    }))
    .sort((a, b) => b.rows - a.rows || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map((entry) => entry.id);
  const named: EngineData = {
    ...ENGINE_DATA,
    settings: {
      ...ENGINE_DATA.settings!,
      excludedMachineIds: [...ENGINE_DATA.settings!.excludedMachineIds, ...busiest],
    },
  };
  const before = run(ENGINE_DATA, AS_OF, DEFAULT_PROFILE);
  const after = run(named, AS_OF, DEFAULT_PROFILE);
  const moved = (keys: readonly string[]) =>
    keys.filter(
      (key) =>
        JSON.stringify(before.figures.find((figure) => figure.key === key)) !==
        JSON.stringify(after.figures.find((figure) => figure.key === key)),
    );

  it('leaves out three machines that between them hold real breakdowns', () => {
    expect(busiest).toHaveLength(3);
    const held = ENGINE_DATA.reports.filter((entry) => busiest.includes(entry.machineId));
    expect(held.length).toBeGreaterThan(100);
    expect(after.excludedMachines).toBe(before.excludedMachines + 3);
  });

  it('moves the 30 figures that read the production machines, and no other', () => {
    expect(READ_THE_PRODUCTION_MACHINES).toHaveLength(30);
    expect(moved(before.figures.map((figure) => figure.key)).sort()).toEqual(
      [...READ_THE_PRODUCTION_MACHINES].sort(),
    );
  });

  it('keeps the 18 that read every machine, and the 3 not computed yet, exactly as they were', () => {
    expect(READ_EVERY_MACHINE).toHaveLength(18);
    expect(moved([...READ_EVERY_MACHINE, ...NOT_COMPUTED])).toEqual([]);
    const statuses = new Map(after.figures.map((figure) => [figure.key, figure.status]));
    for (const key of NOT_COMPUTED) expect(statuses.get(key), key).toBe('not_computed');
    const every = [...READ_THE_PRODUCTION_MACHINES, ...READ_EVERY_MACHINE, ...NOT_COMPUTED];
    expect(every.sort()).toEqual(before.figures.map((figure) => figure.key).sort());
  });
});
