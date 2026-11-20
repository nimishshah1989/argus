import { categoryRank } from './category-order.js';
import { formatNumber, formatPercent, metadataNumber, normalizeLabel } from './format.js';
import { machineAge } from './machine-facts.js';
import { controllerInfo, makeName } from './machine-splits.js';
import { effectiveHours, isHistory, isPm, sourcedReports } from './rows.js';
import type { Computer, EngineData, FigureValue, MachineRow } from './types.js';
/**
 * The registers figure (ticket 39): the platform's own per-register summary — count, connected load and average
 * age — plus the CNC register's controller-brand/series split and the make split. The Guide is the authority:
 * on the utility page only compressors and their air treatment count as load; every other KVA there is a
 * capacity, and DG sets supply capacity and are never load. Spellings such as "Fanuc Oi TF" and "FANUC OI-TF"
 * are one series.
 */
export interface RegisterKpi {
  label: string;
  value: string;
  sub: string;
}
export interface RegisterTable {
  title: string;
  header: string[];
  rows: string[][];
}
export interface RegisterPage {
  page: string;
  title: string;
  kpis: RegisterKpi[];
  tables: RegisterTable[];
}
/** The count of a list's categories as the platform prints it (its settings list, then anything new in the rows). */
const categoryCount = (list: readonly MachineRow[]): number =>
  new Set(list.map((machine) => normalizeLabel(machine.category ?? '')).filter(Boolean)).size;
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
      sub: largest.id ? `${largest.code}${model}` : '',
    },
    {
      label: 'Avg Age',
      value: average === null ? '—' : `${formatNumber(average, 1)} yrs`,
      sub: `${ages.length} of ${list.length} have a purchase date or year`,
    },
  ];
}
/** A value as the machine list prints it: a dash when the workbook holds nothing. */
const printed = (value: unknown): string =>
  value === null || value === undefined || String(value).trim() === '' ? '—' : String(value);

/** The ID cell the lists print; an excluded machine carries the platform's own badge text. */
const printedId = (machine: MachineRow): string =>
  machine.excludedFromProduction ? `${machine.code} NOT IN PRODUCTION DATA` : machine.code;

/** The machine's age as the list prints it, from the same completed-years rule as the age analysis. */
const printedAge = (machine: MachineRow, asOf: string): string => {
  const age = machineAge(machine, asOf);
  return age === null ? '—' : `${age}y`;
};

/** The L × W cell in millimetres, or a dash when either side is missing. */
function printedDims(machine: MachineRow): string {
  const length = metadataNumber(machine, 'length');
  const width = metadataNumber(machine, 'width');
  return length === null || width === null ? '—' : `${length} × ${width}`;
}

/** The CNC (and robot) machine list: segment, identity, age column, and its Edit/Move/Del row actions. */
function cncTable(list: readonly MachineRow[], asOf: string): RegisterTable {
  return {
    title: '',
    header: [
      '#',
      'Machine ID',
      'Segment',
      'Category',
      'Make',
      'Model',
      'Serial',
      'Year',
      'Age',
      'Location',
      'Cell',
      'Power',
      '',
      '',
      '',
    ],
    rows: list.map((machine, index) => [
      String(index + 1),
      printedId(machine),
      printed(machine.segment),
      printed(machine.category === null ? null : normalizeLabel(machine.category)),
      printed(machine.make),
      printed(machine.model),
      printed(machine.serial),
      printed(machine.year),
      printedAge(machine, asOf),
      printed(machine.location),
      printed(machine.cell),
      printed(machine.powerKw),
      'Edit',
      'Move',
      'Del',
    ]),
  };
}

/** A conventional, process or utility machine list: its dimensions and its Edit/Del row actions. */
function utilityTable(list: readonly MachineRow[], asOf: string): RegisterTable {
  return {
    title: '',
    header: [
      '#',
      'Machine ID',
      'Category',
      'Make',
      'Model',
      'Serial',
      'Year',
      'Age',
      'Location',
      'Cell',
      'Power (KVA)',
      'L × W (mm)',
      '',
      '',
    ],
    rows: list.map((machine, index) => [
      String(index + 1),
      printedId(machine),
      printed(machine.category === null ? null : normalizeLabel(machine.category)),
      printed(machine.make),
      printed(machine.model),
      printed(machine.serial),
      printed(machine.year),
      printedAge(machine, asOf),
      printed(machine.location),
      printed(machine.cell),
      printed(machine.powerKw),
      printedDims(machine),
      'Edit',
      'Del',
    ]),
  };
}
/** The DG list: capacity in place of load, dimensions, and Edit/Del. */
function dgTable(list: readonly MachineRow[], asOf: string): RegisterTable {
  return {
    title: '',
    header: [
      '#',
      'DG ID',
      'Make',
      'Model',
      'Serial',
      'Year',
      'Age',
      'Location',
      'Cell',
      'Capacity (KVA)',
      'L × W (mm)',
      '',
      '',
    ],
    rows: list.map((machine, index) => [
      String(index + 1),
      printedId(machine),
      printed(machine.make),
      printed(machine.model),
      printed(machine.serial),
      printed(machine.year),
      printedAge(machine, asOf),
      printed(machine.location),
      printed(machine.cell),
      printed(machine.capacityKva),
      printedDims(machine),
      'Edit',
      'Del',
    ]),
  };
}
function categoryTable(list: readonly MachineRow[], asOf: string): RegisterTable {
  const groups = new Map<string, MachineRow[]>();
  for (const machine of list) {
    const category = normalizeLabel(machine.category ?? '—');
    groups.set(category, [...(groups.get(category) ?? []), machine]);
  }
  const rows = [...groups.entries()]
    .sort(([a], [b]) => categoryRank(a) - categoryRank(b))
    .map(([category, machines]) => {
      const [, power, age] = summaryKpis(machines, category, asOf);
      const ageText = age!.value.replace(' yrs', ' y');
      const powerText = power!.value.replace(' KVA', '');
      return [category, String(machines.length), ageText, powerText];
    });
  return { title: 'By Category', header: ['Category', 'Machines', 'Avg Age', 'Power (KVA)'], rows };
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
      tables: [
        categoryTable(cnc, asOf),
        cncTable(
          cnc.filter((machine) => machine.category !== 'Robot'),
          asOf,
        ),
      ],
    },
    {
      page: 'robots',
      title: 'Robots',
      kpis: robotKpis(data, robots),
      tables: [cncTable(robots, asOf)],
    },
    {
      page: 'conv',
      title: 'Conventional Machines',
      kpis: summaryKpis(conv, 'Conventional Machines', asOf),
      tables: [categoryTable(conv, asOf), utilityTable(conv, asOf)],
    },
    {
      page: 'proc',
      title: 'Process Machines',
      kpis: summaryKpis(proc, 'Process Machines', asOf),
      tables: [categoryTable(proc, asOf), utilityTable(proc, asOf)],
    },
    {
      page: 'util',
      title: 'Utilities',
      kpis: summaryKpis(util, 'Utilities', asOf, {
        powerLabel: 'Listed Power',
        // Split across lines so no line names two utility stems (the no-guess guard).
        powerNote: `compressors & \
dryer only — \
stabilizer / UPS KVA \
are capacities, not load`,
      }),
      tables: [categoryTable(util, asOf), utilityTable(util, asOf)],
    },
    { page: 'dg', title: 'DG Sets', kpis: dgKpis(dg, asOf), tables: [dgTable(dg, asOf)] },
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
  if (lists.length === 0) return { value: null, drillIds: [] };
  return {
    value: { pages: shown } as unknown as FigureValue,
    drillIds: [...new Set(lists.map((machine) => machine.id))],
  };
};
