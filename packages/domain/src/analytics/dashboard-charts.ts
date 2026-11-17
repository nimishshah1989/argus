import { machineAge, machinePrefix, machineYear } from './machine-facts.js';
import { effectiveHours, excludedMachineIds, isHistory, isPm, sourcedReports } from './rows.js';
import type { Computer, EngineData, MachineRow } from './types.js';

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** The CNC production machines: CNC rows, minus the ones the plant leaves out of production data. */
function productionCnc(data: EngineData): MachineRow[] {
  const excluded = excludedMachineIds(data);
  return data.machines.filter((machine) => machine.segment === 'CNC' && !excluded.has(machine.id));
}

interface MachineTotal {
  count: number;
  hours: number;
}

/**
 * The bubble chart (Guide, "Breakdowns vs Downtime"): one bubble per CNC production machine with at least one
 * breakdown; height is the breakdown count, the horizontal position the machine's BD hours and the radius its
 * MTTR (BD hours / breakdowns), sized against the biggest MTTR on the chart.
 */
export const bubbleChart: Computer = ({ data, asOf }) => {
  const machines = productionCnc(data);
  const totals = new Map<string, MachineTotal>(
    machines.map((machine) => [machine.id, { count: 0, hours: 0 }]),
  );
  for (const row of sourcedReports(data)) {
    if (!isHistory(row) || isPm(row)) continue;
    const total = totals.get(row.report.machineId);
    if (total === undefined) continue;
    total.count += 1;
    total.hours += effectiveHours(row.report);
  }
  const plotted = machines.flatMap((machine) => {
    const total = totals.get(machine.id)!;
    return total.count === 0 ? [] : [{ machine, ...total }];
  });
  if (plotted.length === 0) return { value: null, drillIds: [] };
  const maxMttr = Math.max(0.0001, ...plotted.map((row) => row.hours / row.count));
  const points = plotted.map((row) => {
    const mttr = row.hours / row.count;
    const age = machineAge(row.machine, asOf);
    return {
      x: round2(row.hours),
      y: row.count,
      r: 4 + 18 * Math.sqrt(mttr / maxMttr),
      id: row.machine.id,
      model: row.machine.model ?? '—',
      age: age === null ? '—' : `${age} yrs`,
      mttr,
    };
  });
  return {
    value: {
      axes: { x: 'BD Hours (machine total)', y: 'Number of Breakdowns' },
      datasets: [{ label: 'Machines', data: points }],
    },
    drillIds: points.map((point) => point.id),
  };
};

/**
 * The machine expansion timeline (Guide, "Machine Expansion Timeline"): every CNC machine, the Robot included,
 * grouped by purchase year, bars split by the letters of the machine id and a line for the running fleet total.
 */
export const expansionTimeline: Computer = ({ data }) => {
  const rows = data.machines
    .filter((machine) => machine.segment === 'CNC')
    .flatMap((machine) => {
      const year = machineYear(machine);
      return year === null ? [] : [{ machine, year, prefix: machinePrefix(machine) }];
    });
  if (rows.length === 0) return { value: null, drillIds: [] };
  const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
  const prefixes = [...new Set([...rows].sort((a, b) => a.year - b.year).map((row) => row.prefix))];
  let cumulative = 0;
  const timeline = years.map((year) => {
    const added = rows.filter((row) => row.year === year);
    cumulative += added.length;
    return { year, added, cumulative };
  });
  const datasets = prefixes.map((prefix) => ({
    label: prefix,
    data: timeline.map((step) => step.added.filter((row) => row.prefix === prefix).length),
  }));
  datasets.push({ label: 'Cumulative Fleet Size', data: timeline.map((step) => step.cumulative) });
  return {
    value: { axes: { x: '', y: '', y1: '' }, labels: years, datasets },
    drillIds: rows.map((row) => row.machine.id),
  };
};
