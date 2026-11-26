import { OEM_CAUSE_LABELS, type OemCause } from '@uptimo/shared';
import { formatNumber, normalizeLabel } from './format.js';
import { isProduction } from './machine-facts.js';
import { dayNumber, dmy } from './plant-date.js';
import { problemGroupOf } from './problem-groups.js';
import { effectiveHours, isPm, sourcedReports } from './rows.js';
import type { Computer, EngineData, FigureValue, MachineRow } from './types.js';

/** A machine younger than this many days since its purchase date is a young machine (ADR 0051, A2). */
export const YOUNG_DAYS = 300;

/** Warranty runs this many years from the purchase date (ADR 0051, A1). */
export const WARRANTY_YEARS = 1;

const CAUSE_ORDER: readonly OemCause[] = ['oem', 'install', 'ours', 'undecided'];

interface Breakdown {
  ticketId: string;
  machine: MachineRow;
  date: string;
  problem: string;
  group: string;
  action: string;
  hours: number;
  inWarranty: boolean;
  cause: OemCause;
}

const makeModel = (machine: MachineRow): string =>
  `${machine.make ?? ''} ${machine.model ?? ''}`.trim();
const modelKey = (machine: MachineRow): string =>
  `${(machine.make ?? '').trim()}|${(machine.model ?? '').trim()}`.toLowerCase();
const sum = (numbers: readonly number[]): number => numbers.reduce((a, b) => a + b, 0);
const one = (value: number): string => formatNumber(value, 1);
const pct = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;
const push = <K, V>(map: Map<K, V[]>, key: K, value: V): void => {
  map.set(key, [...(map.get(key) ?? []), value]);
};

/** The warranty end as a plant date: the purchase date plus the warranty years. */
const warrantyUntil = (bought: string): string =>
  `${Number(bought.slice(0, 4)) + WARRANTY_YEARS}${bought.slice(4, 10)}`;

type Report = ReturnType<typeof sourcedReports>[number];
type Aged = { machine: MachineRow; bought: number; age: number };

/** The fleet, its breakdowns and the period every rate is read over (1 January of the first year to the last day). */
interface Basis {
  end: number;
  start: number;
  byMachine: Map<string, Report[]>;
  young: Aged[];
  older: Aged[];
}

function basisOf(data: EngineData, asOf: string): Basis | null {
  const today = dayNumber(asOf);
  const fleet = data.machines.filter(isProduction);
  const fleetIds = new Set(fleet.map((machine) => machine.id));
  const rows = sourcedReports(data).filter(
    (row) =>
      !isPm(row) && fleetIds.has(row.report.machineId) && dayNumber(row.report.date) !== null,
  );
  if (today === null || rows.length === 0) return null;
  const dates = rows.map((row) => dayNumber(row.report.date)!);
  const firstYear = new Date(Math.min(...dates) * 86_400_000).getUTCFullYear();
  const aged = fleet.flatMap((machine) => {
    const bought =
      machine.purchasedOn === null ? null : dayNumber(machine.purchasedOn.slice(0, 10));
    return bought === null ? [] : [{ machine, bought, age: today - bought }];
  });
  const byMachine = new Map<string, Report[]>();
  for (const row of rows) push(byMachine, row.report.machineId, row);
  return {
    end: Math.max(...dates),
    start: dayNumber(`${firstYear}-01-01`)!,
    byMachine,
    young: aged.filter(({ age }) => age >= 0 && age < YOUNG_DAYS),
    older: aged.filter(({ age }) => age < 0 || age >= YOUNG_DAYS),
  };
}

const daysOf = (basis: Basis, bought: number): number =>
  Math.max(0, basis.end - Math.max(basis.start, bought) + 1);

/** Breakdowns per 100 machine-days of a group of machines. */
function rateOf(basis: Basis, group: readonly Aged[]): number {
  const days = sum(group.map(({ bought }) => daysOf(basis, bought)));
  const count = sum(group.map(({ machine }) => basis.byMachine.get(machine.id)?.length ?? 0));
  return days === 0 ? 0 : (count / days) * 100;
}

/** Older machines of the same make and model (case-insensitive, not when both blank), else the same category. */
function peersOf(basis: Basis, machine: MachineRow): { peers: Aged[]; basis: string } {
  const key = modelKey(machine);
  const same = key === '|' ? [] : basis.older.filter((peer) => modelKey(peer.machine) === key);
  if (same.length > 0) return { peers: same, basis: 'same make and model' };
  return {
    peers: basis.older.filter((peer) => peer.machine.category === machine.category),
    basis: 'same category',
  };
}

function breakdownsOf(data: EngineData, machine: MachineRow, list: Report[]): Breakdown[] {
  const causes = new Map((data.oemCauses ?? []).map((row) => [row.ticketId, row.cause]));
  const until = warrantyUntil(machine.purchasedOn!);
  return list.map((row) => ({
    ticketId: row.ticket.id,
    machine,
    date: row.report.date,
    problem: row.report.problem,
    group: problemGroupOf(row.report, data.settings?.problemFixes, data.settings?.problemGroups),
    action: row.report.correctiveAction ?? '',
    hours: effectiveHours(row.report),
    inWarranty: row.report.date < until,
    cause: causes.get(row.ticket.id) ?? 'undecided',
  }));
}

/** The cause with the most hours (order oem, install, ours, undecided on ties); blank when there are no hours. */
function mainCause(mine: readonly Breakdown[]): string {
  const hours = CAUSE_ORDER.map((cause) =>
    sum(mine.filter((b) => b.cause === cause).map((b) => b.hours)),
  );
  const top = Math.max(...hours);
  return top > 0 ? OEM_CAUSE_LABELS[CAUSE_ORDER[hours.indexOf(top)]!] : '';
}

function machineFact(basis: Basis, data: EngineData, { machine, bought, age }: Aged) {
  const list = [...(basis.byMachine.get(machine.id) ?? [])].sort(
    (a, b) => dayNumber(a.report.date)! - dayNumber(b.report.date)!,
  );
  const mine = breakdownsOf(data, machine, list);
  const found = peersOf(basis, machine);
  const days = daysOf(basis, bought);
  const own = days === 0 ? 0 : (mine.length / days) * 100;
  const peerRate = rateOf(basis, found.peers);
  return {
    machine,
    age,
    days,
    mine,
    own,
    hours: sum(mine.map((b) => b.hours)),
    until: warrantyUntil(machine.purchasedOn!),
    peerText: `${one(peerRate)} (${found.basis}, ${found.peers.length})`,
    ratio: peerRate > 0 ? `${one(own / peerRate)}x` : '',
    first: list.length > 0 ? `${dayNumber(list[0]!.report.date)! - bought} days` : 'none yet',
    main: mainCause(mine),
  };
}
type Fact = ReturnType<typeof machineFact>;

function modelRows(basis: Basis, models: Map<string, Fact[]>): string[][] {
  return [...models].map(([key, group]) => {
    const peers = key === '|' ? [] : basis.older.filter((peer) => modelKey(peer.machine) === key);
    const count = sum(group.map((row) => row.mine.length));
    const days = sum(group.map((row) => row.days));
    return [
      makeModel(group[0]!.machine),
      String(group.length),
      String(count),
      one(sum(group.map((row) => row.hours))),
      one(days === 0 ? 0 : (count / days) * 100),
      peers.length === 0
        ? 'no older machine of this model'
        : `${one(rateOf(basis, peers))} (${peers.length} older)`,
    ];
  });
}

/** A fault repeats when it hit at least two machines twice or more, or any machine three times. */
function repeatRows(models: Map<string, Fact[]>): string[][] {
  const found = [...models].flatMap(([, group]) => {
    const byProblem = new Map<string, Breakdown[]>();
    for (const b of group.flatMap((row) => row.mine)) push(byProblem, b.group, b);
    return [...byProblem].flatMap(([problem, list]) => {
      const ids = new Set(list.map((b) => b.machine.id));
      if (!((list.length >= 2 && ids.size >= 2) || list.length >= 3)) return [];
      const hours = sum(list.map((b) => b.hours));
      const names = group.filter((row) => ids.has(row.machine.id)).map((r) => r.machine.code);
      const cells = [makeModel(group[0]!.machine), problem, String(list.length)];
      cells.push(String(ids.size), one(hours), names.join(', '));
      return [{ times: list.length, hours, cells }];
    });
  });
  return found.sort((a, b) => b.times - a.times || b.hours - a.hours).map((r) => r.cells);
}

function kpiList(basis: Basis, all: readonly Breakdown[]) {
  const total = sum(all.map((b) => b.hours));
  const hoursOf = (...wanted: OemCause[]): number =>
    sum(all.filter((b) => wanted.includes(b.cause)).map((b) => b.hours));
  const oem = hoursOf('oem', 'install');
  const ours = hoursOf('ours');
  const decided = all.filter((b) => b.cause !== 'undecided').length;
  const compare = `${one(rateOf(basis, basis.young))} per 100 machine-days vs ${one(rateOf(basis, basis.older))} for older machines`;
  return [
    {
      label: 'Young machines',
      value: String(basis.young.length),
      sub: `under ${YOUNG_DAYS} days, ${basis.older.length} older machines used as the comparison`,
    },
    { label: 'Breakdowns', value: String(all.length), sub: compare },
    {
      label: 'Downtime',
      value: `${one(total)} hrs`,
      sub: `${pct(hoursOf('undecided'), total)}% of the hours not decided yet`,
    },
    {
      label: 'OEM or commissioning',
      value: `${one(oem)} hrs`,
      sub: `${pct(oem, total)}% of the hours`,
    },
    { label: 'Our side', value: `${one(ours)} hrs`, sub: `${pct(ours, total)}% of the hours` },
    {
      label: 'Inside warranty',
      value: `${all.filter((b) => b.inWarranty).length} of ${all.length}`,
      sub: `${decided} causes decided by people, ${all.length - decided} not decided`,
    },
  ];
}

const MACHINE_HEADER = [
  'Machine',
  'Make and model',
  'Age (days)',
  'Warranty until',
  'Breakdowns',
  'Hours',
  'Per 100 machine-days',
  'Older peers per 100',
  'vs peers',
  'First breakdown after',
  'Main cause',
];

const machineRow = (m: Fact): string[] => [
  m.machine.code,
  makeModel(m.machine),
  String(m.age),
  m.until,
  String(m.mine.length),
  one(m.hours),
  one(m.own),
  m.peerText,
  m.ratio,
  m.first,
  m.main,
];

/**
 * The OEM Analytics figure (ticket 812, ADR 0051): young CNC production machines, their breakdowns against older
 * peers, by make and model, faults that repeat, and every breakdown with the cause a person decided (Not decided when
 * none). No keyword guess and no rupees. No young machine gives `{ value: null, drillIds: [] }`.
 */
export const oemAnalyticsFigure: Computer = ({ data, asOf }) => {
  const basis = basisOf(data, asOf);
  if (basis === null || basis.young.length === 0) return { value: null, drillIds: [] };
  const facts = basis.young.map((aged) => machineFact(basis, data, aged));
  const all = facts.flatMap((m) => m.mine); // fleet order: same-day ties keep it, as the platform's log did
  const machines = [...facts].sort((a, b) => b.hours - a.hours || b.mine.length - a.mine.length);
  const models = new Map<string, Fact[]>();
  for (const row of machines) push(models, modelKey(row.machine), row);
  const newest = [...all].sort((a, b) => dayNumber(b.date)! - dayNumber(a.date)!);
  const page = {
    page: 'oem',
    title: 'OEM Analytics',
    kpis: kpiList(basis, all),
    tables: [
      { title: 'Machines', header: MACHINE_HEADER, rows: machines.map(machineRow) },
      {
        title: 'By make and model',
        header: [
          'Make and model',
          'Young machines',
          'Breakdowns',
          'Hours',
          'Per 100 machine-days',
          'Older machines of this model',
        ],
        rows: modelRows(basis, models),
      },
      {
        title: 'Faults that repeat across machines of one model',
        header: ['Make and model', 'Problem', 'Times', 'Machines', 'Hours', 'Which machines'],
        rows: repeatRows(models),
      },
      {
        title: 'Every breakdown on a young machine: decide the cause',
        header: ['Date', 'Machine', 'Problem', 'Action taken', 'Hours', 'In warranty', 'Cause'],
        rows: newest.map((b) => [
          dmy(b.date),
          b.machine.code,
          normalizeLabel(b.problem),
          normalizeLabel(b.action),
          one(b.hours),
          b.inWarranty ? 'Yes' : 'No',
          OEM_CAUSE_LABELS[b.cause],
        ]),
        rowTicketIds: newest.map((b) => b.ticketId),
      },
    ],
  };
  return {
    value: { pages: [page] } as unknown as FigureValue,
    drillIds: all.map((b) => b.ticketId),
  };
};
