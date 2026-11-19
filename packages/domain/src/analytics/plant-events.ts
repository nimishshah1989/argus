import { spanOf } from './availability.js';
import { isProduction } from './machine-facts.js';
import { plantDay } from './plant-day.js';
import type { Computer, EngineData, MachineRow } from './types.js';

/**
 * Plant events (ticket 91): a power or air failure is one closed general ticket whose lines name each machine it
 * stopped and for how many minutes (ticket 69, DATA-MAP). Its downtime counts in the fleet's lost hours and so in
 * availability, under its own figure `dashboard.plant-events`; it is never a breakdown, so it adds 0 to every
 * breakdown count, MTTR and MTBF.
 *
 * `PLANT_EVENT_BASIS` is the one config default. `named-machines` (conservative): a machine loses only the minutes
 * its own line records; the plant is not charged to every machine for the event's length. Whether Bhavin counts an
 * outage against every machine, and whether the PM and UTI line codes all count, is an open question
 * (docs/plan/ledger-backend.md); every recorded line counts today.
 */
export const PLANT_EVENT_BASIS = 'named-machines' as const;

export interface PlantEventRow {
  ticketId: string;
  lines: readonly { machineId: string; minutes: number }[];
}

/** The events of the run's span, each with its ticket id; an event whose ticket the run does not hold is left out. */
function eventsIn(data: EngineData, asOf: string): PlantEventRow[] {
  const { from, to } = spanOf(data, asOf);
  const dates = new Map(
    [...data.tickets, ...data.tasks].map((t) => [t.id, plantDay(t.reportedAt, data.timeZone)]),
  );
  return (data.plantEvents ?? []).filter((event) => {
    const day = dates.get(event.ticketId);
    return day !== undefined && day >= from && day <= to;
  });
}

/** Machine-minutes the span's events took from these machines (a machine the fleet does not count loses none). */
export function plantEventMinutes(
  data: EngineData,
  asOf: string,
  machines: readonly MachineRow[],
): number {
  const counted = new Set(machines.map((machine) => machine.id));
  return eventsIn(data, asOf)
    .flatMap((event) => event.lines)
    .filter((line) => counted.has(line.machineId))
    .reduce((sum, line) => sum + line.minutes, 0);
}

/** `dashboard.plant-events`: the production fleet's machine-hours lost to plant events, drilled to every event. */
export const plantEventsFigure: Computer = ({ data, asOf }) => {
  const events = eventsIn(data, asOf);
  const production = data.machines.filter(isProduction);
  const minutes = plantEventMinutes(data, asOf, production);
  return { value: Math.round(minutes / 6) / 10, drillIds: events.map((event) => event.ticketId) };
};
