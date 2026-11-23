import type { EngineData } from '../analytics/types.js';

/** What a cell prints for a machine or ticket the plant data does not list: a dash, never the id. */
export const UNLISTED = '-';

/**
 * The names a person reads in place of the ids the rows carry. A live plant's ids are UUIDs, so every sheet looks a
 * machine up by id and prints its code, and a ticket by id and prints its reference. No id or `null` is a blank cell.
 */
export interface Labels {
  machine: (id: string | null | undefined) => string;
  ticket: (id: string | null | undefined) => string;
}

export function labelsOf(data: EngineData): Labels {
  const machines = new Map(data.machines.map((machine) => [machine.id, machine.code]));
  const tickets = new Map(data.tickets.map((ticket) => [ticket.id, ticket.ref]));
  const lookup =
    (names: ReadonlyMap<string, string>) =>
    (id: string | null | undefined): string =>
      id === null || id === undefined || id === '' ? '' : (names.get(id) ?? UNLISTED);
  return { machine: lookup(machines), ticket: lookup(tickets) };
}
