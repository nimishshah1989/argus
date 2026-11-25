import type {
  BoardToday,
  Config,
  Group,
  ListItem,
  Machine,
  Segment,
  State,
  Ticket,
} from '../../../api.js';
import type { BoardModel } from './model.js';

/**
 * The approved S30 wireframe's plant, made consistent: 12 machines on the board, 8 stopped, plus one machine in a
 * segment kept off the board and one in a hidden group, each with an open breakdown the board must leave out.
 * 10:44 on Tue 24 Nov in the plant's time zone (Asia/Kolkata).
 */
export const FIXTURE_NOW = '2026-11-24T05:14:00.000Z';
const ago = (min: number) => new Date(Date.parse(FIXTURE_NOW) - min * 60_000).toISOString();

const segment = (id: string, code: string, name: string, show = true): Segment => ({
  id,
  code,
  name,
  sort: 0,
  show_on_board: show,
  group_by: 'letters',
});
const SEGMENTS = [
  segment('s-vc', 'VC', 'VMC'),
  segment('s-lt', 'LT', 'Lathe'),
  segment('s-pr', 'PR', 'Press'),
  segment('s-cp', 'CP', 'Compressor'),
  segment('s-ob', 'OB', 'Off the board', false),
];
const GROUPS: Group[] = [
  { id: 'g-vc', segment_id: 's-vc', code: 'VMC', name: 'Vertical', sort: 0, hidden: false },
  { id: 'g-hide', segment_id: 's-vc', code: 'OLD', name: 'Retired', sort: 1, hidden: true },
];

const machine = (
  code: string,
  segment_id: string,
  cell: string | null,
  group_id = null as string | null,
): Machine => ({
  id: `m-${code}`,
  code,
  category: null,
  cell,
  segment_id,
  group_id,
  criticality: null,
});
const MACHINES: Machine[] = [
  machine('VC-01', 's-vc', 'Cell 2', 'g-vc'),
  machine('VC-02', 's-vc', 'Cell 2', 'g-vc'),
  machine('VC-03', 's-vc', 'Cell 2', 'g-vc'),
  machine('VC-09', 's-vc', 'Cell 3', 'g-vc'),
  machine('VC-17', 's-vc', 'Cell 2', 'g-vc'),
  machine('LT-01', 's-lt', 'Cell 1'),
  machine('LT-02', 's-lt', 'Cell 1'),
  machine('LT-08', 's-lt', 'Cell 1'),
  machine('PR-01', 's-pr', 'Cell 4'),
  machine('PR-02', 's-pr', 'Cell 4'),
  machine('CP-01', 's-cp', 'Utility'),
  machine('CP-02', 's-cp', 'Utility'),
  machine('OB-01', 's-ob', 'Cell 9'),
  machine('HG-01', 's-vc', 'Cell 8', 'g-hide'),
];

/** An open breakdown stopped `ageMin` minutes ago. */
export function breakdown(
  code: string,
  status: 'open' | 'working' | 'waiting',
  ageMin: number,
  extra: Partial<Ticket> = {},
): Ticket {
  return {
    id: `t-${code}`,
    ref: `BD-${code}`,
    kind: 'stopped',
    status,
    machineId: `m-${code}`,
    machineSnapshot: { code },
    machineRunningAt: null,
    machineStoppedAt: ago(ageMin),
    reportedAt: ago(ageMin),
    figures: null,
    waitReason: status === 'waiting' ? 'spare' : null,
    ...extra,
  } as unknown as Ticket;
}

const WAIT_REASONS = [
  {
    id: 'l-spare',
    list: 'wait_reason',
    code: 'spare',
    label: 'Spare part (vendor)',
    labelGu: null,
    labelHi: null,
    sort: 1,
    active: true,
    isVendor: true,
    pausesSla: false,
    tag: null,
  },
] as ListItem[];

export const fixtureConfig = {
  timeZone: 'Asia/Kolkata',
  lists: { wait_reason: WAIT_REASONS },
  segments: SEGMENTS,
  groups: GROUPS,
  machines: MACHINES,
} as unknown as Config;

/**
 * Nobody has started: PR-02 5 h 10 min, LT-08 2 h 39 min, VC-17 12 min. Being repaired: CP-02 1 d 2 h, CP-01 1 h 40
 * min, LT-02 1 h 5 min, VC-03 38 min. Paused and waiting: VC-09 3 h 2 min (Spare part (vendor)). Ages: under 1 h 2,
 * 1 to 4 h 4, 4 to 24 h 1, over 1 day 1.
 */
export const fixtureState = {
  open: [
    breakdown('VC-17', 'open', 12),
    breakdown('LT-08', 'open', 159),
    breakdown('PR-02', 'open', 310),
    breakdown('VC-03', 'working', 38),
    breakdown('LT-02', 'working', 65),
    breakdown('CP-01', 'working', 100),
    breakdown('CP-02', 'working', 1560),
    breakdown('VC-09', 'waiting', 182),
    breakdown('OB-01', 'open', 2000),
    breakdown('HG-01', 'open', 3000),
  ],
  needReport: [],
  now: FIXTURE_NOW,
} as unknown as State;

export const fixtureToday: BoardToday = {
  now: FIXTURE_NOW,
  from: '2026-11-23T18:30:00.000Z',
  to: '2026-11-24T18:30:00.000Z',
  tickets: 9,
  notStarted: 3,
  stillOpen: 8,
  responseMin: 14,
  repairMin: 52,
  waitingMin: 20,
  responseCount: 9,
  responseClosed: 6,
  repairCount: 6,
  repairClosed: 6,
};

/** The gallery's frozen board: `boardModel` over the replies above, in English. */
export function boardFixture(tv: boolean): BoardModel {
  void tv;
  throw new Error('not implemented');
}
