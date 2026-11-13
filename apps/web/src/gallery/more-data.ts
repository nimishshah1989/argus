import type { Resource, Transport } from '../data/index.js';
import { failing, never, resources, type Example } from './patterns-data.js';

export const WIZARD_MACHINES = ['CNC-07', 'LATHE-02', 'DRILL-01'] as const;
export const WIZARD_PROBLEMS = ['queue.problem.1', 'queue.problem.2', 'queue.problem.3'] as const;
export const SEGMENTS = ['cnc', 'conventional', 'process', 'utilities'] as const;

export interface BoardRow {
  id: string;
  ref: string;
  machine: string;
  segment: 'cnc' | 'conventional';
  status: 'stopped' | 'in_progress' | 'waiting';
  problemKey: string;
}

const BOARD_ROWS: BoardRow[] = [
  ['BD-0101', 'CNC-07', 'cnc', 'stopped'],
  ['BD-0102', 'LATHE-02', 'conventional', 'stopped'],
  ['BD-0103', 'VMC-03', 'cnc', 'in_progress'],
  ['BD-0104', 'DRILL-01', 'conventional', 'in_progress'],
  ['BD-0105', 'CNC-11', 'cnc', 'waiting'],
].map(([ref, machine, segment, status], i) => ({
  id: `b-${i + 1}`,
  ref: ref!,
  machine: machine!,
  segment: segment as BoardRow['segment'],
  status: status as BoardRow['status'],
  problemKey: `queue.problem.${i + 1}`,
}));

const boardTransport: Record<Example, Transport> = {
  ready: async (path) => {
    const segment = new URL(path, 'http://gallery.invalid').searchParams.get('segment');
    const items = segment ? BOARD_ROWS.filter((r) => r.segment === segment) : BOARD_ROWS;
    return { items, nextCursor: null };
  },
  loading: never,
  empty: async () => ({ items: [], nextCursor: null }),
  error: failing,
  offline: never,
};

export const boardResources: Record<Example, Resource<unknown, BoardRow>> = resources(
  'board',
  boardTransport,
  '/gallery/board',
);

export const DASHBOARD_EXAMPLES = ['ready', 'loading', 'error', 'offline'] as const;
export type DashboardExample = (typeof DASHBOARD_EXAMPLES)[number];
export interface GalleryDashboard {
  open: number;
  stopped: number;
  repair: string;
  bySegment: number[]; // in SEGMENTS order
  weeks: string[];
  downtime: { cnc: number[]; conventional: number[] };
}

const DASHBOARD: GalleryDashboard = {
  open: 5,
  stopped: 2,
  repair: '1:40',
  bySegment: [4, 2, 1, 0],
  weeks: ['W41', 'W42', 'W43', 'W44', 'W45', 'W46'],
  downtime: { cnc: [12, 9, 14, 8, 6, 7], conventional: [5, 7, 4, 6, 3, 4] },
};

const dashboardTransport: Record<DashboardExample, Transport> = {
  ready: async () => DASHBOARD,
  loading: never,
  error: failing,
  offline: never,
};

export const dashboardResources: Record<
  DashboardExample,
  Resource<GalleryDashboard, unknown>
> = resources('dashboard', dashboardTransport, '/gallery/dashboard');
