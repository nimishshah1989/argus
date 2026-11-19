import { addDays, plantDayOf } from '@uptimo/shared';
import { SEGMENT, TENANT, scopedId, type MachineFixture, type SeedStatement } from './fixtures.js';

/**
 * The PM calendar's fixtures (ticket 50c): three machines of its own so no other journey's tickets or plans move,
 * two plans due today (the crowded pair) and a third machine holding an open PM job and an open work request, both
 * for the machine page's Tasks block. Dates come from the plant's today, so the journey is not tied to a month.
 */

const PROJECTS = ['chromium', 'phone', 'gujarati'];

export const PM_CALENDAR_MACHINES: MachineFixture[] = PROJECTS.map((_, index) => ({
  id: scopedId(`10000000-0000-0000-0006-${String(index).padStart(12, '0')}`),
  code: `PMC-${index + 1}`,
  category: 'VMC',
  cell: '9',
}));

export function pmCalendarMachine(projectName: string): MachineFixture {
  const machine = PM_CALENDAR_MACHINES[Math.max(0, PROJECTS.indexOf(projectName))];
  if (!machine) throw new Error(`No PM calendar machine for ${projectName}`);
  return machine;
}

/** The machine whose page holds the open work request and PM job: its plan is the one the job suppresses. */
export function pmCalendarTaskMachine(projectName: string): MachineFixture {
  const machine = PM_CALENDAR_MACHINES[PM_CALENDAR_MACHINES.length - 1];
  if (!machine) throw new Error(`No PM task machine for ${projectName}`);
  return machine;
}

/** The plant's today, the anchor every seeded date uses (`tenant.time_zone` boots as Asia/Kolkata). */
export const PLANT_TODAY = plantDayOf(new Date().toISOString(), 'Asia/Kolkata');

/** A plant day `offset` days from today; negative is the past. */
export function calendarDay(offset: number): string {
  return addDays(PLANT_TODAY, offset);
}

/** The first Monday–Saturday after today: a day the server accepts a move to. */
export function nextWorkingDay(): string {
  let day = addDays(PLANT_TODAY, 1);
  while (dayOfWeek(day) === 0) day = addDays(day, 1);
  return day;
}

function dayOfWeek(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

const machineOf = (machine: MachineFixture): SeedStatement => ({
  text: 'INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES ($1, $2, $3, $4, $5, $6)',
  values: [machine.id, TENANT.id, machine.code, SEGMENT.id, machine.category, machine.cell],
});

/** A 182-day plan whose next due is today: `last_done_on` is the plant day 182 days ago. */
const planOf = (machine: MachineFixture): SeedStatement => ({
  text: `INSERT INTO pm_plan (tenant_id, machine_id, title, interval_days, checklist, active, last_done_on)
         VALUES ($1, $2, $3, 182, '[]', true, $4)`,
  values: [TENANT.id, machine.id, `${machine.code} preventive maintenance`, calendarDay(-182)],
});

interface TicketSeed {
  machine: MachineFixture;
  id: string;
  ref: string;
  kind: 'stopped' | 'general';
  channel: 'floor' | 'pm';
  problem: string;
  reportedOn: string;
  scheduledOn: string | null;
}

const ticketOf = ({
  machine,
  id,
  ref,
  kind,
  channel,
  problem,
  reportedOn,
  scheduledOn,
}: TicketSeed): SeedStatement => ({
  text: `INSERT INTO ticket (id, tenant_id, ref, kind, status, machine_id, machine_snapshot, problem,
           reported_at, raised_channel, severity, task_expected_on)
         VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, $8, $9, 'S3', $10)`,
  values: [
    id,
    TENANT.id,
    ref,
    kind,
    machine.id,
    JSON.stringify({ code: machine.code, category: machine.category, cell: machine.cell }),
    problem,
    `${reportedOn}T04:00:00Z`,
    channel,
    scheduledOn,
  ],
});

export function pmCalendarSeedStatements(): SeedStatement[] {
  const [first, second, third] = PM_CALENDAR_MACHINES as [
    MachineFixture,
    MachineFixture,
    MachineFixture,
  ];
  return [
    ...PM_CALENDAR_MACHINES.map(machineOf),
    planOf(first),
    planOf(second),
    planOf(third),
    // The third machine's plan is suppressed by its open PM job, which is itself overdue on the machine page.
    ticketOf({
      machine: third,
      id: scopedId('10000000-0000-0000-0007-000000000001'),
      ref: 'WR-PMC3',
      kind: 'general',
      channel: 'pm',
      problem: `PM due: ${third.code} preventive maintenance`,
      reportedOn: calendarDay(-5),
      scheduledOn: calendarDay(-2),
    }),
    ticketOf({
      machine: third,
      id: scopedId('10000000-0000-0000-0007-000000000002'),
      ref: 'WR-PMC3B',
      kind: 'general',
      channel: 'floor',
      problem: 'Guard door sticks',
      reportedOn: calendarDay(-1),
      scheduledOn: null,
    }),
  ];
}
