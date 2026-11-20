import type { DecisionKind } from '../../../ui/v2/domain/decision-row.js';
import type { ActionStatus } from './model.js';

/** The kinds of action the month's plan holds, each with the word on its pill and the tone it wears. */
export type Lane = 'before' | 'fix' | 'overhaul' | 'whywhy' | 'spares' | 'record';
export const LANES: Record<Lane, { label: string; kind: DecisionKind }> = {
  before: { label: 'Before next month', kind: 'inspect' },
  fix: { label: 'Fix for good', kind: 'fix' },
  overhaul: { label: 'Overhaul or replace?', kind: 'decide' },
  whywhy: { label: 'Why-Why due', kind: 'plan' },
  spares: { label: 'Spares to keep ready', kind: 'plan' },
  record: { label: 'Fix the record', kind: 'plan' },
};

export const STATUS: Record<ActionStatus, string> = {
  todo: 'Not started',
  doing: 'In progress',
  done: 'Done',
  skip: 'Not needed',
};

/** The plant's loss rate, ₹ an hour of breakdown, as on the Dashboard's key figures. */
export const RATE = 3329;
/** Someone with this many open actions or more is over the line. */
export const OVERLOAD = 8;
/** Last month's figures, for the key figures' change against it. */
export const LAST_MONTH = { open: 17, unowned: 6, stakeTenths: 1612, progress: 13 };

/** An invented action: the machines it names, what it wins back a month (tenths of an hour), who has it, and when it closed. */
export type Raw = {
  id: string;
  lane: Lane;
  codes: string[];
  title: string;
  tenths: number;
  status: ActionStatus;
  owner: string | null;
  /** The week of the month a closed action closed in (1 to 4). */
  week?: number;
};

const A = 'arjun-v';
const N = 'neel-s';
const M = 'meera-k';

/** Twenty-four invented actions on the Dashboard's machines: 19 open, 5 closed; 4 of the open have no owner. */
export const RAW: Raw[] = [
  {
    id: 'a01',
    lane: 'fix',
    codes: ['VC-67', 'VC-94'],
    title: 'Stop axis motor and encoder failures',
    tenths: 481,
    status: 'doing',
    owner: A,
  },
  {
    id: 'a02',
    lane: 'overhaul',
    codes: ['TC-4'],
    title: 'Overhaul or replace the turning centre',
    tenths: 188,
    status: 'todo',
    owner: null,
  },
  {
    id: 'a03',
    lane: 'before',
    codes: ['GRD-127'],
    title: 'Inspect the grinder before December',
    tenths: 53,
    status: 'todo',
    owner: null,
  },
  {
    id: 'a04',
    lane: 'spares',
    codes: ['TC-56'],
    title: 'Keep one turret clamp kit in stock',
    tenths: 96,
    status: 'todo',
    owner: null,
  },
  {
    id: 'a05',
    lane: 'whywhy',
    codes: ['TC-111'],
    title: 'Finish the Why-Why on the 11-hour spindle stop',
    tenths: 62,
    status: 'todo',
    owner: null,
  },
  {
    id: 'a06',
    lane: 'fix',
    codes: ['VC-24'],
    title: 'Fix the repeat coolant leak',
    tenths: 74,
    status: 'doing',
    owner: A,
  },
  {
    id: 'a07',
    lane: 'before',
    codes: ['VC-31'],
    title: 'Inspect the spindle belt before the next PM',
    tenths: 41,
    status: 'todo',
    owner: A,
  },
  {
    id: 'a08',
    lane: 'spares',
    codes: ['VC-67'],
    title: 'Stock two encoder cables',
    tenths: 58,
    status: 'todo',
    owner: A,
  },
  {
    id: 'a09',
    lane: 'fix',
    codes: ['TC-111'],
    title: 'Replace the worn ball screw',
    tenths: 112,
    status: 'doing',
    owner: A,
  },
  {
    id: 'a10',
    lane: 'before',
    codes: ['TC-56'],
    title: 'Check the tool changer arm',
    tenths: 66,
    status: 'doing',
    owner: A,
  },
  {
    id: 'a11',
    lane: 'whywhy',
    codes: ['VC-94'],
    title: 'Why-Why on the stuck tool changer arm',
    tenths: 47,
    status: 'todo',
    owner: A,
  },
  {
    id: 'a12',
    lane: 'record',
    codes: ['VC-18'],
    title: 'Log the alarm number on every axis stop',
    tenths: 25,
    status: 'todo',
    owner: A,
  },
  {
    id: 'a13',
    lane: 'before',
    codes: ['VC-35'],
    title: 'Move the warranty PM to 24-Nov-2026',
    tenths: 30,
    status: 'todo',
    owner: A,
  },
  {
    id: 'a14',
    lane: 'fix',
    codes: ['TC-4'],
    title: 'Fix the spindle alarm that keeps stopping the lathe',
    tenths: 142,
    status: 'doing',
    owner: N,
  },
  {
    id: 'a15',
    lane: 'before',
    codes: ['VC-26'],
    title: 'Inspect the clamp before it fails',
    tenths: 38,
    status: 'todo',
    owner: N,
  },
  {
    id: 'a16',
    lane: 'spares',
    codes: ['GRD-127'],
    title: 'Keep a pump seal in the store',
    tenths: 29,
    status: 'todo',
    owner: N,
  },
  {
    id: 'a17',
    lane: 'record',
    codes: ['TC-4'],
    title: 'Write the repair notes on every lathe stop',
    tenths: 22,
    status: 'todo',
    owner: N,
  },
  {
    id: 'a18',
    lane: 'before',
    codes: ['VC-44'],
    title: 'Inspect the lubricant line',
    tenths: 35,
    status: 'doing',
    owner: M,
  },
  {
    id: 'a19',
    lane: 'whywhy',
    codes: ['TC-117'],
    title: 'Finish the Why-Why on the conveyor stops',
    tenths: 51,
    status: 'todo',
    owner: M,
  },
  {
    id: 'a20',
    lane: 'fix',
    codes: ['VC-18'],
    title: 'Fit the axis encoder cover',
    tenths: 64,
    status: 'done',
    owner: A,
    week: 1,
  },
  {
    id: 'a21',
    lane: 'spares',
    codes: ['TC-8'],
    title: 'Stock a coolant pump',
    tenths: 33,
    status: 'done',
    owner: A,
    week: 2,
  },
  {
    id: 'a22',
    lane: 'before',
    codes: ['VC-61'],
    title: 'Inspect the chiller',
    tenths: 27,
    status: 'done',
    owner: N,
    week: 2,
  },
  {
    id: 'a23',
    lane: 'record',
    codes: ['VC-72'],
    title: 'Correct the missing stop times',
    tenths: 18,
    status: 'done',
    owner: M,
    week: 3,
  },
  {
    id: 'a24',
    lane: 'whywhy',
    codes: ['GRD-124'],
    title: 'Why-Why on the grinder stop',
    tenths: 44,
    status: 'skip',
    owner: M,
    week: 3,
  },
];
