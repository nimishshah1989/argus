import { dayNumber } from './plant-date.js';
import type { EngineData, MachineRow } from './types.js';

/** A CNC machine the plant counts in production data: the Robot and any Settings exclusion are left out. */
export const isProduction = (machine: MachineRow): boolean =>
  machine.segment === 'CNC' && !machine.excludedFromProduction;

/**
 * The plant's own list of machines left out of production data counts as the flag on each machine row: a figure reads
 * one or the other, and a machine named only in the list is left out of every production figure all the same.
 */
export function withListedExclusions(data: EngineData): EngineData {
  const listed = new Set(data.settings?.excludedMachineIds ?? []);
  if (listed.size === 0) return data;
  return {
    ...data,
    machines: data.machines.map((machine) =>
      listed.has(machine.id) && !machine.excludedFromProduction
        ? { ...machine, excludedFromProduction: true }
        : machine,
    ),
  };
}

/** How many of the plant's machines its settings leave out of production data (an id that is no machine adds none). */
export function listedExclusions(data: EngineData): number {
  const listed = new Set(data.settings?.excludedMachineIds ?? []);
  return data.machines.filter((machine) => listed.has(machine.id)).length;
}

/** The year the platform files a machine under: the purchase date's year, else the Year field, else none. */
export function machineYear(machine: MachineRow): number | null {
  const bought = machine.purchasedOn;
  if (bought !== null) {
    const year = Number.parseInt(bought.slice(0, 4), 10);
    if (Number.isFinite(year)) return year;
  }
  if (machine.year !== null) {
    const year = Number.parseInt(String(machine.year), 10);
    if (Number.isFinite(year) && year !== 0) return year;
  }
  return null;
}

/**
 * The short type the platform groups the timeline by: the letters before the machine number (`TC-3` -> `TC`,
 * `S-1` -> `S`). A name that is all letters (`BOXY`) falls back to its category, as the platform does.
 */
export function machinePrefix(machine: MachineRow): string {
  const match = /^[A-Za-z]+/.exec(machine.id);
  if (match !== null && match[0].length < machine.id.length) return match[0];
  return machine.category ?? machine.id;
}

/** A plant date's year, month and day, or null when the text is not a date. */
function dateParts(date: string): [number, number, number] | null {
  const [year, month, day] = date.split('-').map(Number);
  return year && month && day ? [year, month, day] : null;
}

/** Completed years between a purchase date and the as-of date; null when the date is not a plant date. */
function ageFromPurchaseDate(bought: string, asOf: string): number | null {
  const born = dateParts(bought.slice(0, 10));
  const now = dateParts(asOf);
  if (born === null || now === null) return null;
  const [year, month, day] = born;
  const [asOfYear, asOfMonth, asOfDay] = now;
  const beforeBirthday = asOfMonth < month || (asOfMonth === month && asOfDay < day);
  return Math.max(0, asOfYear - year - (beforeBirthday ? 1 : 0));
}

/** Completed years from the purchase date to `asOf`; the Year field estimates when only the year is known. */
export function machineAge(machine: MachineRow, asOf: string): number | null {
  const bought = machine.purchasedOn;
  const exact = bought === null ? null : ageFromPurchaseDate(bought, asOf);
  if (exact !== null) return exact;
  const [asOfYear = 0] = asOf.split('-').map(Number);
  const known = machine.year;
  if (known === null || known <= 1900 || known > asOfYear) return null;
  return asOfYear - known;
}

/** The plant day the machine joined the fleet (its purchase date), or null when no purchase date is known. */
export function machineDayNumber(machine: MachineRow): number | null {
  return machine.purchasedOn === null ? null : dayNumber(machine.purchasedOn.slice(0, 10));
}
