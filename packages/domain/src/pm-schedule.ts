import { pmNextDue, pmToleranceDays, pmWithinWindow } from '@uptimo/shared';
// The PM calendar's pure shape (ticket 50a, R2/R5): one occurrence per machine — its effective plan's next due
// or the open PM ticket that replaces it. An over-cap day is crowded and gets the nearest free working day
// inside its tolerance, never before today. A drag writes the ticket, never the plan.
export interface PmCalendarPlan {
  planId: string;
  machineId: string;
  machineCode: string;
  title: string;
  /** ISO instant; its plant-local day is the next-due anchor. */
  createdAt: string;
  lastDoneOn: string | null;
  intervalDays: number | null;
}
export interface PmCalendarTicket {
  ticketId: string;
  machineId: string;
  machineCode: string;
  title: string;
  scheduledOn: string;
  /** `status !== 'open'` or `started_at` set: the server refuses to move it (R3). */
  started: boolean;
}
export interface PmCalendarOptions {
  from: string;
  to: string;
  today: string;
  timeZone: string;
  /** One PM per working day (R5); the plant's setting is a later slice. */
  cap?: number;
  /** Sunday 0; Monday–Saturday is the platform's default (R4). */
  workingDays?: readonly number[];
}
export interface PmOccurrence {
  planId: string | null;
  machineId: string;
  machineCode: string;
  title: string;
  dueOn: string;
  scheduledOn: string;
  toleranceDays: number;
  ticketId: string | null;
  status: 'planned' | 'open';
  movable: boolean;
  crowded: boolean;
  suggestedOn: string | null;
}

/** The platform's defaults: one PM a day and a Monday–Saturday week (R4/R5). */
export const PM_CAP = 1;
export const PM_WORKING_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6];
const DAY = 86_400_000;
const addDays = (day: string, n: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const dayOfWeek = (day: string): number => new Date(`${day}T00:00:00Z`).getUTCDay();
// Forward first, then backward; inside the tolerance and never before today.
export function pmSuggestDate(input: {
  scheduledOn: string;
  dueOn: string;
  toleranceDays: number;
  today: string;
  occupied: ReadonlySet<string>;
  workingDays?: readonly number[];
}): string | null {
  const workingDays = input.workingDays ?? PM_WORKING_DAYS;
  const search = (step: 1 | -1): string | null => {
    for (let n = 1; n <= input.toleranceDays; n += 1) {
      const day = addDays(input.scheduledOn, step * n);
      if (day < input.today) continue;
      if (!workingDays.includes(dayOfWeek(day))) continue;
      if (!pmWithinWindow(day, input.dueOn, input.toleranceDays)) continue;
      if (input.occupied.has(day)) continue;
      return day;
    }
    return null;
  };
  return search(1) ?? search(-1);
}
function planOccurrence(
  plan: PmCalendarPlan,
  ticket: PmCalendarTicket | undefined,
  timeZone: string,
): PmOccurrence | null {
  if (plan.intervalDays === null) return null;
  const dueOn = pmNextDue(plan, timeZone);
  if (!dueOn) return null;
  return {
    planId: plan.planId,
    machineId: plan.machineId,
    machineCode: plan.machineCode,
    title: ticket?.title ?? plan.title,
    dueOn,
    scheduledOn: ticket?.scheduledOn ?? dueOn,
    toleranceDays: pmToleranceDays(plan.intervalDays),
    ticketId: ticket?.ticketId ?? null,
    status: ticket ? 'open' : 'planned',
    movable: ticket ? !ticket.started : true,
    crowded: false,
    suggestedOn: null,
  };
}
function ticketOccurrence(
  plan: PmCalendarPlan | undefined,
  ticket: PmCalendarTicket,
  timeZone: string,
): PmOccurrence {
  const dueOn = plan ? (pmNextDue(plan, timeZone) ?? ticket.scheduledOn) : ticket.scheduledOn;
  return {
    planId: plan?.planId ?? null,
    machineId: ticket.machineId,
    machineCode: ticket.machineCode,
    title: ticket.title,
    dueOn,
    scheduledOn: ticket.scheduledOn,
    toleranceDays: pmToleranceDays(plan?.intervalDays ?? null),
    ticketId: ticket.ticketId,
    status: 'open',
    movable: !ticket.started && (plan === undefined || plan.intervalDays !== null),
    crowded: false,
    suggestedOn: null,
  };
}

function occurrencesOf(
  plans: readonly PmCalendarPlan[],
  tickets: readonly PmCalendarTicket[],
  timeZone: string,
): PmOccurrence[] {
  const planByMachine = new Map<string, PmCalendarPlan>();
  for (const plan of plans)
    if (!planByMachine.has(plan.machineId)) planByMachine.set(plan.machineId, plan);
  const ticketByMachine = new Map<string, PmCalendarTicket>();
  for (const ticket of tickets)
    if (!ticketByMachine.has(ticket.machineId)) ticketByMachine.set(ticket.machineId, ticket);

  const handled = new Set<string>();
  const occurrences: PmOccurrence[] = [];
  for (const plan of planByMachine.values()) {
    const occurrence = planOccurrence(plan, ticketByMachine.get(plan.machineId), timeZone);
    if (!occurrence) continue;
    handled.add(plan.machineId);
    occurrences.push(occurrence);
  }
  for (const ticket of ticketByMachine.values())
    if (!handled.has(ticket.machineId))
      occurrences.push(ticketOccurrence(planByMachine.get(ticket.machineId), ticket, timeZone));
  return occurrences;
}
function markLoad(
  occurrences: readonly PmOccurrence[],
  options: PmCalendarOptions,
  cap: number,
  workingDays: readonly number[],
): void {
  const load = new Map<string, number>();
  for (const item of occurrences) load.set(item.scheduledOn, (load.get(item.scheduledOn) ?? 0) + 1);
  const occupied = new Set(
    [...load.entries()].filter(([, count]) => count >= cap).map(([day]) => day),
  );
  for (const item of occurrences) {
    item.crowded = (load.get(item.scheduledOn) ?? 0) > cap;
    item.suggestedOn =
      item.crowded && item.movable
        ? pmSuggestDate({
            scheduledOn: item.scheduledOn,
            dueOn: item.dueOn,
            toleranceDays: item.toleranceDays,
            today: options.today,
            occupied,
            workingDays,
          })
        : null;
  }
}

// Every occurrence counts towards the load; only the asked range is returned, and `crowded` follows the item's day.
export function pmCalendar(
  plans: readonly PmCalendarPlan[],
  tickets: readonly PmCalendarTicket[],
  options: PmCalendarOptions,
): { items: PmOccurrence[]; cap: number } {
  const cap = options.cap ?? PM_CAP;
  const workingDays = options.workingDays ?? PM_WORKING_DAYS;
  const occurrences = occurrencesOf(plans, tickets, options.timeZone);
  markLoad(occurrences, options, cap, workingDays);
  const items = occurrences
    .filter((item) => item.scheduledOn >= options.from && item.scheduledOn <= options.to)
    .sort(
      (a, b) =>
        a.scheduledOn.localeCompare(b.scheduledOn) ||
        a.machineCode.localeCompare(b.machineCode) ||
        (a.planId ?? '').localeCompare(b.planId ?? ''),
    );
  return { items, cap };
}
export interface PmEffectivePlan {
  id: string;
  machineId: string | null;
  category: string | null;
  active: boolean;
  updatedAt: string | Date;
}
const newestFirst = (a: PmEffectivePlan, b: PmEffectivePlan): number =>
  new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
// The pure twin of `pmPlansForScheduling` (R3): the active machine plan, else the newest category plan.
export function effectivePmPlan<T extends PmEffectivePlan>(
  plans: readonly T[],
  machine: { id: string; category: string | null; status?: string },
): T | null {
  if (machine.status === 'scrapped') return null;
  const active = plans.filter((plan) => plan.active);
  const own = active.filter((plan) => plan.machineId === machine.id).sort(newestFirst)[0];
  if (own) return own;
  if (!machine.category) return null;
  return (
    active
      .filter((plan) => plan.machineId === null && plan.category === machine.category)
      .sort(newestFirst)[0] ?? null
  );
}
