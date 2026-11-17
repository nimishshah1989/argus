import { formatNumber, formatPercent, normalizeLabel } from './format.js';
import { machineAge } from './machine-facts.js';
import { controllerInfo, makeName } from './machine-splits.js';
import { effectiveHours, isHistory, isPm, sourcedReports } from './rows.js';
import type { Computer, EngineData, FigureValue, MachineRow } from './types.js';

/**
 * The registers figure (ticket 39): the platform's own per-register summary — count, connected load and average
 * age — plus the CNC register's controller-brand/series split and the make split. The Guide is the authority:
 * utilities hold power only for compressors and dryers (a stabilizer/UPS KVA is capacity, not load), DG sets show
 * supply capacity and are never load, and spellings such as "Fanuc Oi TF" and "FANUC OI-TF" are one series.
 */
export interface RegisterKpi {
  label: string;
  value: string;
  sub: string;
}

export interface RegisterPage {
  page: string;
  title: string;
  kpis: RegisterKpi[];
}

/** The count of a list's categories as the platform prints it (its settings list, then anything new in the rows). */
function categoryCount(list: readonly MachineRow[]): number {
  return new Set(list.map((machine) => normalizeLabel(machine.category ?? '')).filter(Boolean))
    .size;
}

/** Count, connected load and average age: the summary above every register list. */
function summaryKpis(
  list: readonly MachineRow[],
  label: string,
  asOf: string,
  options: { powerLabel?: string; powerNote?: string } = {},
): RegisterKpi[] {
  const powerLabel = options.powerLabel ?? 'Connected Load';
  const power = list.reduce((sum, machine) => sum + (machine.powerKw ?? 0), 0);
  const ages = list
    .map((machine) => machineAge(machine, asOf))
    .filter((age): age is number => age !== null);
  const average = ages.length > 0 ? ages.reduce((sum, age) => sum + age, 0) / ages.length : null;
  const withoutPower = list.filter((machine) => (machine.powerKw ?? 0) <= 0).length;
  const note =
    options.powerNote ??
    (withoutPower > 0
      ? `${withoutPower} machine${withoutPower === 1 ? '' : 's'} without power data`
      : 'all have power data');
  return [
    { label, value: String(list.length), sub: `${categoryCount(list)} categories` },
    {
      label: powerLabel,
      value: power > 0 ? `${formatNumber(power, 1)} KVA` : '—',
      sub: note,
    },
    {
      label: 'Avg Age',
      value: average === null ? '—' : `${formatNumber(average, 1)} yrs`,
      sub: `${ages.length} of ${list.length} have a purchase date or year`,
    },
  ];
}

/** The controller brand cards: the brand, its machine count and its top three series with counts. */
function controllerKpis(list: readonly MachineRow[]): RegisterKpi[] {
  const groups = new Map<string, { count: number; series: Map<string, number> }>();
  for (const machine of list) {
    const info = controllerInfo(machine);
    const group = groups.get(info.brand) ?? { count: 0, series: new Map<string, number>() };
    group.count += 1;
    group.series.set(info.series, (group.series.get(info.series) ?? 0) + 1);
    groups.set(info.brand, group);
  }
  const total = list.length;
  return [...groups.entries()]
    .sort(([, left], [, right]) => right.count - left.count)
    .map(([brand, group]) => {
      const series = [...group.series.entries()]
        .sort(([, left], [, right]) => right - left)
        .slice(0, 3)
        .map(([name, count]) => `${name} (${count})`)
        .join(', ');
      return {
        label: brand,
        value: String(group.count),
        sub: `${formatPercent(group.count / total)} of machines · ${group.series.size} series. ${series}`,
      };
    });
}

/** The make cards: the make, its machine count and its top two categories with counts. */
function makeKpis(list: readonly MachineRow[]): RegisterKpi[] {
  const groups = new Map<string, { count: number; categories: Map<string, number> }>();
  for (const machine of list) {
    const name = makeName(machine);
    const group = groups.get(name) ?? { count: 0, categories: new Map<string, number>() };
    group.count += 1;
    const category = normalizeLabel(machine.category ?? '—');
    group.categories.set(category, (group.categories.get(category) ?? 0) + 1);
    groups.set(name, group);
  }
  const total = list.length;
  return [...groups.entries()]
    .sort(
      ([leftName, left], [rightName, right]) =>
        right.count - left.count || leftName.localeCompare(rightName),
    )
    .map(([make, group]) => {
      const top = [...group.categories.entries()]
        .sort(([, left], [, right]) => right - left)
        .slice(0, 2)
        .map(([category, count]) => `${category} (${count})`)
        .join(', ');
      return {
        label: make,
        value: String(group.count),
        sub: `${formatPercent(group.count / total)} of machines. ${top}`,
      };
    });
}

/** The robots page: its own three cards (the platform keeps robots out of the CNC register split). */
function robotKpis(data: EngineData, robots: readonly MachineRow[]): RegisterKpi[] {
  const ids = new Set(robots.map((robot) => robot.id));
  const rows = sourcedReports(data).filter(
    (row) => isHistory(row) && !isPm(row) && ids.has(row.report.machineId),
  );
  const hours = rows.reduce((sum, row) => sum + effectiveHours(row.report), 0);
  const power = robots.reduce((sum, robot) => sum + (robot.powerKw ?? 0), 0);
  return [
    { label: 'Robots', value: String(robots.length), sub: 'robots and autoloaders in the plant' },
    { label: 'Connected load', value: `${power.toFixed(1)} kW`, sub: 'rated power of all robots' },
    {
      label: 'Breakdowns',
      value: String(rows.length),
      sub: `${hours.toFixed(1)} h downtime in total`,
    },
  ];
}

/** The DG page: supply capacity is never load, so these cards print capacity and the largest set. */
function dgKpis(list: readonly MachineRow[], asOf: string): RegisterKpi[] {
  const capacity = list.reduce((sum, set) => sum + (set.capacityKva ?? 0), 0);
  const largest = list.reduce(
    (best, set) => ((set.capacityKva ?? 0) > (best.capacityKva ?? 0) ? set : best),
    {} as MachineRow | Partial<MachineRow>,
  );
  const ages = list
    .map((machine) => machineAge(machine, asOf))
    .filter((age): age is number => age !== null);
  const average = ages.length > 0 ? ages.reduce((sum, age) => sum + age, 0) / ages.length : null;
  const model = 'model' in largest && largest.model ? ` · ${largest.model}` : '';
  return [
    {
      label: 'DG Sets',
      value: String(list.length),
      sub: 'power sources — not part of connected load',
    },
    {
      label: 'Generating Capacity',
      value: `${formatNumber(capacity, 0)} KVA`,
      sub: 'total output capacity of all DG sets',
    },
    {
      label: 'Largest Set',
      value: largest.id ? `${formatNumber(largest.capacityKva ?? 0, 0)} KVA` : '—',
      sub: largest.id ? `${largest.id}${model}` : '',
    },
    {
      label: 'Avg Age',
      value: average === null ? '—' : `${formatNumber(average, 1)} yrs`,
      sub: `${ages.length} of ${list.length} have a purchase date or year`,
    },
  ];
}

/** The five register lists the platform shows, each with its own page. */
function pages(data: EngineData, asOf: string): RegisterPage[] {
  const cnc = data.machines.filter((machine) => machine.segment === 'CNC');
  const robots = cnc.filter((machine) => machine.category === 'Robot');
  const conv = data.machines.filter((machine) => machine.segment === 'Conventional');
  const proc = data.machines.filter((machine) => machine.segment === 'Process');
  const util = data.machines.filter((machine) => machine.segment === 'Utility');
  const dg = data.machines.filter((machine) => machine.segment === 'DG');
  return [
    {
      page: 'machines',
      title: 'CNC Machines',
      kpis: [...summaryKpis(cnc, 'CNC Machines', asOf), ...controllerKpis(cnc), ...makeKpis(cnc)],
    },
    { page: 'robots', title: 'Robots', kpis: robotKpis(data, robots) },
    {
      page: 'conv',
      title: 'Conventional Machines',
      kpis: summaryKpis(conv, 'Conventional Machines', asOf),
    },
    { page: 'proc', title: 'Process Machines', kpis: summaryKpis(proc, 'Process Machines', asOf) },
    {
      page: 'util',
      title: 'Utilities',
      kpis: summaryKpis(util, 'Utilities', asOf, {
        powerLabel: 'Listed Power',
        powerNote: 'compressors & dryer only — stabilizer / UPS KVA are capacities, not load',
      }),
    },
    { page: 'dg', title: 'DG Sets', kpis: dgKpis(dg, asOf) },
  ];
}

/** Every register page, drilling to every machine the pages list. */
export const registers: Computer = ({ data, asOf }) => {
  const shown = pages(data, asOf);
  const lists = [
    ...data.machines.filter((machine) => machine.segment === 'CNC'),
    ...data.machines.filter((machine) => machine.segment === 'Conventional'),
    ...data.machines.filter((machine) => machine.segment === 'Process'),
    ...data.machines.filter((machine) => machine.segment === 'Utility'),
    ...data.machines.filter((machine) => machine.segment === 'DG'),
  ];
  return {
    value: { pages: shown } as unknown as FigureValue,
    drillIds: [...new Set(lists.map((machine) => machine.id))],
  };
};
