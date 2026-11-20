import type { CellData, MachineData, MachineState } from '../../../ui/v2/domain/plant.js';
import type { Point } from '../../../ui/v2/points.js';
import { TYPES } from './types.js';
import { glue, pts } from './text.js';

/** Invented machines for the gallery: 9 cells, 126 machines, their breakdown hours adding up to the month's 312.4 h. */
export const MONTH_HOURS = 312.4;

const WHY: Record<MachineState, Point[]> = {
  run: pts('Running since **6:10 today**', '**0 breakdowns** in 30 days'),
  risk: pts(
    '~~3 breakdowns~~ in 30 days, up from **1**',
    'Repairs taking ~~2× longer~~ than its type',
  ),
  down: pts(
    'Down for !!2 h 40 min!!',
    'Problem: **spindle alarm**',
    'Assigned to {{person:neel-s|Neel S}}',
  ),
  pm: pts('Quarterly PM, **started 9:30**', 'Back by ++14:00++ (plan)'),
  idle: pts('No job loaded since **yesterday**'),
};
const ODD: Record<string, MachineState> = {
  '1-3': 'down',
  '1-12': 'idle',
  '2-1': 'pm',
  '2-8': 'risk',
  '3-4': 'pm',
  '3-9': 'risk',
  '4-2': 'risk',
  '4-10': 'down',
  '5-6': 'down',
  '5-11': 'risk',
  '6-0': 'pm',
  '6-7': 'risk',
  '7-3': 'down',
  '7-12': 'idle',
  '8-0': 'risk',
  '8-5': 'down',
  '8-9': 'risk',
  '8-13': 'idle',
  '9-2': 'pm',
  '9-6': 'risk',
};
const SIZES = [14, 14, 15, 13, 15, 14, 14, 15, 12];
const KINDS = ['TC', 'VC', 'VC', 'TC', 'VC', 'VTL', 'VC', 'TC', 'GRD'] as const;
/** How heavy each state's month is, in tenths of an hour before the month's total shares them out. */
const WEIGHT: Record<MachineState, number> = { down: 220, risk: 110, pm: 30, idle: 0, run: 0 };

const raw = SIZES.flatMap((n, c) =>
  Array.from({ length: n }, (_, i) => {
    const state = ODD[`${c + 1}-${i}`] ?? 'run';
    const kind = KINDS[c]!;
    const weight = WEIGHT[state] && WEIGHT[state] + ((c * 7 + i * 13) % 17);
    return { c, i, state, kind, weight };
  }),
);
const totalWeight = raw.reduce((s, m) => s + m.weight, 0);
const tenths = raw.map((m) => Math.floor((m.weight / totalWeight) * MONTH_HOURS * 10));
// What rounding down left over goes to the heaviest machines, one tenth each, so the month adds up exactly.
let left = Math.round(MONTH_HOURS * 10) - tenths.reduce((s, t) => s + t, 0);
[...raw.keys()]
  .sort((a, b) => raw[b]!.weight - raw[a]!.weight)
  .forEach((k) => left-- > 0 && (tenths[k]! += 1));

const machines: MachineData[] = raw.map((m, k) => {
  const hours = tenths[k]! / 10;
  const type = TYPES[m.kind];
  return {
    code: `${m.kind}-${m.c * 15 + m.i + 1}`,
    name: `${type.label} ${m.c * 15 + m.i + 1}`,
    typeLabel: type.label,
    cat: type.cat,
    cell: `Cell ${m.c + 1}`,
    state: m.state,
    hours: { shown: glue(`${hours.toFixed(1)} h`), value: hours },
    stops: m.state === 'run' ? m.i % 3 : m.state === 'idle' ? 0 : 3 + ((m.c + m.i) % 9),
    trend: Array.from({ length: 12 }, (_, w) =>
      Math.max(0, Math.round((hours / 4) * (1 + Math.sin(w + m.i)) * 10) / 10),
    ),
    why: WHY[m.state],
  };
});

export const plantCells: CellData[] = SIZES.map((_, c) => ({
  name: `Cell ${c + 1}`,
  machines: machines.filter((m) => m.cell === `Cell ${c + 1}`),
}));
