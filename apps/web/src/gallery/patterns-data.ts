import { ApiError, defineResource, type Resource, type Transport } from '../data/index.js';

export const EXAMPLES = ['ready', 'loading', 'empty', 'error', 'offline'] as const;
export type Example = (typeof EXAMPLES)[number];

export interface GalleryRow {
  id: string;
  ref: string;
  problemKey: string;
}
export interface GalleryDetail {
  ref: string;
  machine: string;
  reported: string;
  problemKey: string;
  historyKeys: string[];
}

const ROWS: GalleryRow[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `gallery-${n}`,
  ref: `BD-010${n}`,
  problemKey: `queue.problem.${n}`,
}));
const DETAIL: GalleryDetail = {
  ref: 'BD-0101',
  machine: 'CNC-07',
  reported: '08:30',
  problemKey: 'queue.problem.1',
  historyKeys: ['detail.history.1', 'detail.history.2'],
};

export const never: Transport = () => new Promise(() => undefined);
export const failing: Transport = () => Promise.reject(new ApiError('internal', 'Sample error'));

const queueTransport: Record<Example, Transport> = {
  ready: async (path) => {
    const cursor = new URL(path, 'http://gallery.invalid').searchParams.get('cursor');
    return cursor === 'page-2'
      ? { items: ROWS.slice(3), nextCursor: null }
      : { items: ROWS.slice(0, 3), nextCursor: 'page-2' };
  },
  loading: never,
  empty: async () => ({ items: [], nextCursor: null }),
  error: failing,
  offline: never,
};
const detailTransport: Record<Example, Transport> = {
  ready: async () => DETAIL,
  loading: never,
  empty: () => Promise.reject(new ApiError('not_found', 'Not found')),
  error: failing,
  offline: never,
};

export function resources<TOne, TItem, S extends string>(
  kind: string,
  transports: Record<S, Transport>,
  path = '/gallery/tickets',
): Record<S, Resource<TOne, TItem>> {
  return Object.fromEntries(
    Object.entries<Transport>(transports).map(([state, transport]) => [
      state,
      defineResource<TOne, TItem>({ key: `gallery-${kind}-${state}`, path, transport }),
    ]),
  ) as Record<S, Resource<TOne, TItem>>;
}

export const queueResources = resources<unknown, GalleryRow, Example>('queue', queueTransport);
export const detailResources = resources<GalleryDetail, unknown, Example>(
  'detail',
  detailTransport,
);
