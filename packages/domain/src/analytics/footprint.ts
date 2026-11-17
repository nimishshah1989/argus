import { formatNumber, formatPercent, metadataNumber, normalizeLabel } from './format.js';
import type { Computer, MachineRow } from './types.js';

/**
 * The footprint figure (ticket 39): machine area is Length × Width from the machine master, and the floor needed
 * is the smallest square the machines fit in with the Guide's 1.0 m clearance between machines and at the
 * boundary. The platform's packing is ported exactly: each machine becomes (long side + clearance) by (short side +
 * clearance), sorted deepest first, shelf-packed at every candidate square width, and the smallest side wins.
 */
const CLEARANCE_M = 1;

interface FootprintItem {
  machine: MachineRow;
  /** The long side in metres and the short side, so orientation never depends on which field was filled. */
  length: number;
  width: number;
  area: number;
  /** The shelf footprint including clearance. */
  slot: number;
  depth: number;
}

/** A machine's footprint in metres from its millimetre `length` and `width`, or null when either is missing. */
function itemOf(machine: MachineRow): FootprintItem | null {
  const length = metadataNumber(machine, 'length');
  const width = metadataNumber(machine, 'width');
  if (length === null || width === null || length <= 0 || width <= 0) return null;
  const long = Math.max(length, width) / 1000;
  const short = Math.min(length, width) / 1000;
  return {
    machine,
    length: long,
    width: short,
    area: long * short,
    slot: long + CLEARANCE_M,
    depth: short + CLEARANCE_M,
  };
}

/** Shelf packing in rows: place each item after the last, wrap when the row would pass the width. */
function pack(
  items: readonly FootprintItem[],
  containerWidth: number,
): { usedW: number; usedH: number } {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let usedWidth = 0;
  for (const item of items) {
    if (x > 0 && x + item.slot > containerWidth) {
      y += rowHeight;
      x = 0;
      rowHeight = 0;
    }
    x += item.slot;
    usedWidth = Math.max(usedWidth, x);
    rowHeight = Math.max(rowHeight, item.depth);
  }
  return { usedW: usedWidth, usedH: y + rowHeight };
}

/** The smallest square side that fits every machine: the Guide's own search over candidate widths. */
function floorSide(items: readonly FootprintItem[]): number {
  if (items.length === 0) return 0;
  const gross = items.reduce((sum, item) => sum + item.slot * item.depth, 0);
  const base = Math.sqrt(gross);
  const widest = Math.max(...items.map((item) => item.slot));
  const order = items
    .slice()
    .sort((left, right) => right.depth - left.depth || right.slot - left.slot);
  let best = Number.POSITIVE_INFINITY;
  for (let percent = 80; percent <= 220; percent += 2) {
    const width = Math.max((base * percent) / 100, widest);
    const packed = pack(order, width);
    const side = Math.max(packed.usedW, packed.usedH) + CLEARANCE_M;
    best = Math.min(best, side);
  }
  return best;
}

/** The per-category average footprint table: its own averages, area and share, largest average first. */
function categoryTable(items: readonly FootprintItem[], machineArea: number) {
  const groups = new Map<string, FootprintItem[]>();
  for (const item of items) {
    const category = normalizeLabel(item.machine.category ?? '—');
    groups.set(category, [...(groups.get(category) ?? []), item]);
  }
  const rows = [...groups.entries()].map(([category, group]) => {
    const total = group.reduce((sum, item) => sum + item.area, 0);
    const avgL = group.reduce((sum, item) => sum + item.length, 0) / group.length;
    const avgW = group.reduce((sum, item) => sum + item.width, 0) / group.length;
    return {
      avgArea: total / group.length,
      row: [
        category,
        String(group.length),
        `${formatNumber(avgL, 2)} × ${formatNumber(avgW, 2)}`,
        formatNumber(total / group.length, 1),
        formatNumber(total, 1),
        formatPercent(machineArea === 0 ? 0 : total / machineArea),
      ],
    };
  });
  rows.sort((left, right) => right.avgArea - left.avgArea);
  return {
    title: 'Average Footprint by Category',
    header: [
      'Category',
      'Machines',
      'Avg L × W (m)',
      'Avg Area (m²)',
      'Total Area (m²)',
      '% of Machine Area',
    ],
    rows: rows.map((entry) => entry.row),
  };
}

/** The footprint cards and its category table, drilling to the machines with dimensions. */
export const footprint: Computer = ({ data }) => {
  const machines = data.machines.filter(
    (machine) => machine.segment === 'CNC' && !machine.excludedFromProduction,
  );
  const items = machines.flatMap((machine) => {
    const item = itemOf(machine);
    return item ? [item] : [];
  });
  const machineArea = items.reduce((sum, item) => sum + item.area, 0);
  const side = floorSide(items);
  const floorArea = side * side;
  const kpis = [
    {
      label: 'Machines Mapped',
      value: `${items.length} / ${machines.length}`,
      sub: 'machines with length and width',
    },
    { label: 'Machine Area', value: `${formatNumber(machineArea, 0)} m²`, sub: 'sum of L × W' },
    {
      label: 'Floor Needed',
      value: `${formatNumber(floorArea, 0)} m²`,
      sub: `Square: ${formatNumber(side, 1)} m long × ${formatNumber(side, 1)} m broad · 1.0 m gaps and margin`,
    },
    {
      label: 'Machine Area Share',
      value: formatPercent(floorArea === 0 ? 0 : machineArea / floorArea),
      sub: 'of the square (rest = gaps and aisles)',
    },
    {
      label: 'Avg Footprint',
      value: `${formatNumber(items.length === 0 ? 0 : machineArea / items.length, 1)} m²`,
      sub: 'per machine',
    },
  ];
  return {
    value: { kpis, tables: [categoryTable(items, machineArea)] },
    drillIds: items.map((item) => item.machine.id),
  };
};
