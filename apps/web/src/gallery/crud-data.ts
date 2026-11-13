import { ApiError, type Transport } from '../data/index.js';

export interface GalleryMachine {
  id: string;
  code: string;
  name: string;
  active: boolean;
}
export interface GalleryRequest {
  method: string;
  path: string;
  body: unknown;
}

/** The Idempotency-Key of each POST, in order. */
export const postKeys: (string | undefined)[] = [];

/** Every call, in order; read by the browser tests. */
export const requests: GalleryRequest[] = [];

// Module state, fresh on each page load.
const rows: GalleryMachine[] = [
  { id: 'm-1', code: 'CNC-07', name: 'VMC 850', active: true },
  { id: 'm-2', code: 'LATHE-02', name: 'Lathe', active: true },
  { id: 'm-3', code: 'DRILL-01', name: 'Radial drill', active: false },
];

type Body = Partial<GalleryMachine>;

function post(body: Body): GalleryMachine {
  if (rows.some((r) => r.code === body.code)) throw new ApiError('conflict', 'Code already used');
  const row = {
    id: `m-${rows.length + 1}`,
    code: body.code ?? '',
    name: body.name ?? '',
    active: true,
  };
  rows.push(row);
  return { ...row };
}

function put(path: string, body: Body): GalleryMachine {
  const id = decodeURIComponent(path.split('/').pop() ?? '');
  const row = rows.find((r) => r.id === id);
  if (!row) throw new ApiError('not_found', 'Not found');
  if (id === 'm-3' && body.active === true) throw new ApiError('conflict', 'Machine is retired');
  Object.assign(row, { code: body.code, name: body.name, active: body.active });
  return { ...row };
}

/** The fake machines API: GET lists, POST adds, PUT replaces a row; nothing else is allowed. */
export const machinesTransport: Transport = async (path, init) => {
  const method = init?.method ?? 'GET';
  const body = (init?.body ? JSON.parse(String(init.body)) : undefined) as Body | undefined;
  requests.push({ method, path, body });
  if (method === 'GET') return { items: rows.map((r) => ({ ...r })), nextCursor: null };
  if (method === 'POST') {
    postKeys.push((init?.headers as Record<string, string> | undefined)?.['Idempotency-Key']);
    return post(body ?? {});
  }
  if (method === 'PUT') return put(path, body ?? {});
  throw new ApiError('method_not_allowed', 'Not allowed');
};
