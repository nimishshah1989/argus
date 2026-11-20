import i18n from 'i18next';
import type { QueryClient } from '@tanstack/react-query';
import type { FiguresReply } from '@uptimo/shared/analytics';
import type { Config } from '@uptimo/shared/replies';
import { analyticsFiguresQuery, getConfig, getMe, getState } from '../../../api.js';
import { ApiError } from '../../../data/index.js';
import { LiveOffline } from './live-error.js';
import type { Translate } from './read.js';

/** The catalogue as the adapters ask for it: one language, the reader's. */
export const catalogue: Translate = (key, values) => i18n.t(key, { ...values }) as string;

/**
 * The one live source for v2 screens. Each read is the v1 screens' own query (same key, same fetch, same cache), so a
 * page that was just open costs no request and a figure the two agree on is fetched once. The client's own default
 * retries a lost connection twice. When the connection is lost and an older copy is cached, that copy is served (as
 * v1 does); with none, the read fails as `LiveOffline`. A refusal stays the server's `ApiError`.
 */
async function read<T>(
  client: QueryClient | undefined,
  query: { queryKey: readonly unknown[]; queryFn: () => Promise<T> },
): Promise<T> {
  if (!client) throw new Error('no query client');
  const key = [...query.queryKey];
  try {
    return await client.fetchQuery({ queryKey: key, queryFn: query.queryFn, staleTime: 30_000 });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const cached = client.getQueryData<T>(key);
    if (cached !== undefined) return cached;
    throw new LiveOffline();
  }
}

type Client = QueryClient | undefined;

/** What the engine says today, as the v1 screens read it. */
export const liveReply = (client: Client): Promise<FiguresReply> =>
  read(client, analyticsFiguresQuery as unknown as Parameters<typeof read<FiguresReply>>[1]);

/** The signed-in role, which gates money and the correction of a move. */
export const liveRole = async (client: Client): Promise<string | undefined> =>
  (await read(client, { queryKey: ['me'], queryFn: getMe })).user.role;

/** The plant's own lists: its machines, cells and people. */
export const liveConfig = (client: Client): Promise<Config> =>
  read(client, { queryKey: ['config'], queryFn: getConfig });

/** The open tickets right now (which machines are stopped). */
export const liveOpen = async (client: Client) =>
  (await read(client, { queryKey: ['state'], queryFn: getState })).open;

/** A machine's code from its id, by the plant's own list. */
export async function liveCodes(client: Client): Promise<(machineId: string) => string | null> {
  const { machines } = await liveConfig(client);
  return (machineId) => machines.find((machine) => machine.id === machineId)?.code ?? null;
}
