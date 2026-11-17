import { formatNumber } from './format.js';
import { machineAge } from './machine-facts.js';
import { effectiveHours, isHistory, isPm, sourcedReports } from './rows.js';
import type { Computer, FigureValue, MachineRow } from './types.js';

/**
 * The age analysis figure (ticket 39): age is completed years from the purchase date (the Year field estimates
 * when only the year is known), bands are 0-5, 5-10, 10-15, 15-20 and 20+ with the lower limit in and the upper
 * out, and each band prints its breakdown hours and its average per machine. The Guide's authority is Section 7;
 * the machines are the CNC production fleet, and PM is never a breakdown while a NO-DT row counts as one at 0 hrs.
 */
interface Band {
  label: string;
  low: number;
  high: number;
}

const BANDS: readonly Band[] = [
  { label: '0-5 yrs', low: 0, high: 5 },
  { label: '5-10 yrs', low: 5, high: 10 },
  { label: '10-15 yrs', low: 10, high: 15 },
  { label: '15-20 yrs', low: 15, high: 20 },
  { label: '20+ yrs', low: 20, high: Number.POSITIVE_INFINITY },
];

/** The CNC production fleet, whose breakdown log the bands divide. */
const productionFleet = (machines: readonly MachineRow[]): MachineRow[] =>
  machines.filter((machine) => machine.segment === 'CNC' && !machine.excludedFromProduction);

/** One machine's actual breakdowns: PM excluded, NO-DT counted but worth no downtime hours. */
function breakdownsOf(data: Parameters<Computer>[0]['data'], machineId: string) {
  return sourcedReports(data).filter(
    (row) => isHistory(row) && !isPm(row) && row.report.machineId === machineId,
  );
}

/** The band cards: each band's total hours, machine count and breakdown count, then its average per machine. */
export const ageAnalysis: Computer = ({ data, asOf }) => {
  const fleet = productionFleet(data.machines);
  const bands = BANDS.map((band) => {
    const machines = fleet.filter((machine) => {
      const age = machineAge(machine, asOf);
      return age !== null && age >= band.low && age < band.high;
    });
    const rows = machines.flatMap((machine) => breakdownsOf(data, machine.id));
    const hours = rows.reduce((sum, row) => sum + effectiveHours(row.report), 0);
    return { band, machines, hours, breakdowns: rows.length };
  });
  const totals = bands.map(({ band, machines, hours, breakdowns }) => ({
    label: band.label,
    value: `${formatNumber(hours, 1)} hrs`,
    sub: `${machines.length} machines, ${breakdowns} breakdowns`,
  }));
  const averages = bands.map(({ band, machines, hours }) => ({
    label: band.label,
    value: machines.length === 0 ? '—' : `${formatNumber(hours / machines.length, 2)} hrs`,
    sub: `${formatNumber(hours, 1)} hrs ÷ ${machines.length} machines`,
  }));
  const aged = bands.flatMap(({ machines }) => machines);
  const page = { page: 'a8', title: 'Age Analysis', kpis: [...totals, ...averages], tables: [] };
  return {
    value: { pages: [page] } as unknown as FigureValue,
    drillIds: aged.map((machine) => machine.id),
  };
};
