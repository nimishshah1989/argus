import { SEGMENT, TENANT, scopedId, type MachineFixture, type SeedStatement } from './fixtures.js';

/**
 * The PM job fixtures (ticket 49c): one machine, its plan and one open PM job per project, so no two workers
 * share a plan. The plan carries the journey's checklist (three points to tick and one measured reading) and a
 * 500-unit meter, so the close records a reading and moves the plan.
 */

const PROJECTS = ['chromium', 'phone', 'gujarati'];

/** One PM machine per project: `PM-<project + 1>`. */
export const PM_MACHINES: MachineFixture[] = PROJECTS.map((_, index) => ({
  id: scopedId(`10000000-0000-0000-0003-${String(index).padStart(12, '0')}`),
  code: `PM-${index + 1}`,
  category: 'VMC',
  cell: '7',
}));

/** A second machine per project, for the settings journey: its plan is not the phone journey's. */
export const PM_SETTINGS_MACHINES: MachineFixture[] = PROJECTS.map((_, index) => ({
  id: scopedId(`10000000-0000-0000-0004-${String(index).padStart(12, '0')}`),
  code: `PS-${index + 1}`,
  category: 'VMC',
  cell: '8',
}));

export function pmMachine(projectName: string): MachineFixture {
  return pick(PM_MACHINES, projectName);
}

export function pmSettingsMachine(projectName: string): MachineFixture {
  return pick(PM_SETTINGS_MACHINES, projectName);
}

function pick(machines: MachineFixture[], projectName: string): MachineFixture {
  const machine = machines[Math.max(0, PROJECTS.indexOf(projectName))];
  if (!machine) throw new Error(`No PM machine for ${projectName}`);
  return machine;
}

/** The plan's numbered checklist (R5): three points to tick, keyed by number, and one `<point>.<metric>` reading. */
export const PM_CHECKLIST = [
  { id: '1', kind: 'tick', point: 1 },
  { id: '2', kind: 'tick', point: 2 },
  { id: '3', kind: 'tick', point: 3 },
  { id: '4.bx', kind: 'reading', point: 4, metric: 'bx', label: 'Backlash X', unit: 'mm' },
];

/** The meter reading the journey types; it moves the plan's `last_meter_reading`. */
export const PM_METER = 1200;

const planOf = (machine: MachineFixture, meter: number | null): SeedStatement => ({
  text: `INSERT INTO pm_plan (tenant_id, machine_id, title, interval_days, meter_interval, meter_tolerance,
           last_meter_reading, last_done_on, checklist, active)
         VALUES ($1, $2, $3, 182, $4, 50, 1000, '2026-05-01', $5, true)`,
  values: [
    TENANT.id,
    machine.id,
    `${machine.code} preventive maintenance`,
    meter,
    JSON.stringify(PM_CHECKLIST),
  ],
});

const machineOf = (machine: MachineFixture): SeedStatement => ({
  text: 'INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES ($1, $2, $3, $4, $5, $6)',
  values: [machine.id, TENANT.id, machine.code, SEGMENT.id, machine.category, machine.cell],
});

export function pmSeedStatements(): SeedStatement[] {
  return [
    ...PM_SETTINGS_MACHINES.map((machine) => machineOf(machine)),
    // The settings plans have no meter: the settings journey only edits their interval.
    ...PM_SETTINGS_MACHINES.map((machine) => planOf(machine, null)),
    ...PM_MACHINES.flatMap((machine, index) => [
      machineOf(machine),
      planOf(machine, 500),
      {
        text: `INSERT INTO ticket (id, tenant_id, ref, kind, status, machine_id, machine_snapshot, problem,
                 reported_at, raised_channel, severity)
               VALUES ($1, $2, $3, 'general', 'open', $4, $5, $6, '2026-11-19T04:00:00Z', 'pm', 'S3')`,
        values: [
          scopedId(`10000000-0000-0000-0005-${String(index).padStart(12, '0')}`),
          TENANT.id,
          `WR-PM${index + 1}`,
          machine.id,
          JSON.stringify({ code: machine.code, category: machine.category, cell: machine.cell }),
          `PM due: ${machine.code} preventive maintenance`,
        ],
      } satisfies SeedStatement,
    ]),
  ];
}
