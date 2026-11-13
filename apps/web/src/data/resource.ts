import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { http } from './client.js';

export type Transport = (path: string, init?: RequestInit) => Promise<unknown>;
export type ListQuery = Record<string, string | number | readonly string[] | undefined>;
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
export interface ResourceSpec {
  /** First query-key segment. */
  key: string;
  /** e.g. '/api/v1/tickets' or '/api/v1/machines/:id/criticality'. */
  path: string;
  transport?: Transport;
}
export interface Resource<TOne, TItem> {
  key: string;
  one(id?: string): Promise<TOne>;
  list(query?: ListQuery): Promise<CursorPage<TItem>>;
  create<R = unknown>(
    body: unknown,
    options?: { id?: string; idempotencyKey?: string },
  ): Promise<R>;
  update<R = unknown>(id: string | undefined, body: unknown): Promise<R>;
  useOne(id?: string): UseQueryResult<TOne, Error>;
  useList(
    query?: ListQuery,
  ): UseInfiniteQueryResult<InfiniteData<CursorPage<TItem>, string | undefined>, Error>;
  /** POST path, JSON body; on success awaits invalidateQueries({ queryKey: [key] }). */
  useCreate(): UseMutationResult<unknown, Error, { body: unknown; idempotencyKey?: string }>;
  /** PUT url(id), JSON body; on success awaits invalidateQueries({ queryKey: [key] }). */
  useUpdate(): UseMutationResult<unknown, Error, { id: string; body: unknown }>;
}

function search(query: ListQuery): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    params.set(name, Array.isArray(value) ? value.join(',') : String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

const json = (method: string, body: unknown, headers?: Record<string, string>): RequestInit => ({
  method,
  headers,
  body: JSON.stringify(body),
});

/** One server resource: the request builders, two read hooks and two write hooks. Types come from `@uptimo/shared`; the reply is not parsed. */
export function defineResource<TOne = unknown, TItem = never>(
  spec: ResourceSpec,
): Resource<TOne, TItem> {
  const { key, path } = spec;
  const send = (spec.transport ?? http) as <T>(url: string, init?: RequestInit) => Promise<T>;
  const url = (id?: string): string => {
    if (id === undefined) return path;
    const encoded = encodeURIComponent(id);
    return path.includes(':id') ? path.replace(':id', encoded) : `${path}/${encoded}`;
  };
  const one = (id?: string) => send<TOne>(url(id));
  const list = (query: ListQuery = {}) => send<CursorPage<TItem>>(`${path}${search(query)}`);
  const create: Resource<TOne, TItem>['create'] = (body, options) =>
    send(
      url(options?.id),
      json(
        'POST',
        body,
        options?.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
      ),
    );
  const update: Resource<TOne, TItem>['update'] = (id, body) => send(url(id), json('PUT', body));
  const settled = (client: QueryClient) => () => client.invalidateQueries({ queryKey: [key] });
  return {
    key,
    one,
    list,
    create,
    update,
    useOne: (id) => useQuery({ queryKey: [key, 'one', id ?? null], queryFn: () => one(id) }),
    useList: (query) =>
      useInfiniteQuery({
        queryKey: [key, 'list', query ?? {}],
        initialPageParam: undefined as string | undefined,
        queryFn: ({ pageParam }) => list({ ...query, cursor: pageParam }),
        getNextPageParam: (page) => page.nextCursor ?? undefined,
      }),
    useCreate: () =>
      useMutation({
        mutationFn: (v: { body: unknown; idempotencyKey?: string }) =>
          create(v.body, { idempotencyKey: v.idempotencyKey }),
        onSuccess: settled(useQueryClient()),
      }),
    useUpdate: () =>
      useMutation({
        mutationFn: (v: { id: string; body: unknown }) => update(v.id, v.body),
        onSuccess: settled(useQueryClient()),
      }),
  };
}
