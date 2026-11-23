import { MAX_DRILL_IDS, type DrillReply, type DrillType } from '@uptimo/shared/analytics';
import type { ProviderContext } from '../data.js';
import { catalogue, liveCodes, liveDrill, liveReply } from '../figures/live.js';
import { machineDrill } from './machine.js';
import { rowsModel } from './model.js';
import { energyLoad, parseTile, tileMachines } from './tile.js';

const oneDecimal = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Every row a figure counted: the server answers at most `MAX_DRILL_IDS` ids a read, so a long list is read in parts. */
async function rowsOf(
  type: DrillType,
  ids: readonly string[],
  read: (type: DrillType, ids: readonly string[]) => Promise<DrillReply>,
): Promise<DrillReply> {
  const parts: (readonly string[])[] = [];
  for (let at = 0; at < ids.length; at += MAX_DRILL_IDS)
    parts.push(ids.slice(at, at + MAX_DRILL_IDS));
  const replies = await Promise.all(parts.map((part) => read(type, part)));
  return { type, rows: replies.flatMap((reply) => reply.rows) } as DrillReply;
}

/**
 * The rows behind the figure the URL names, from the engine's reply (`GET /analytics/figures`, for the figure's value
 * and the ids it counted) and the drill read (`GET /analytics/drill`, the same read v1's drill table makes). A figure
 * the plant does not have, one not computed yet, or one that counted nothing is `null`: the drawer says so.
 */
export async function liveRows(figure: string, { client }: ProviderContext) {
  const reply = await liveReply(client);
  const tile = parseTile(figure);
  const counted = countedBy(figure, tile, reply);
  if (counted === null) return null;
  const { found, ids, load } = counted;
  const [drill, code] = await Promise.all([
    rowsOf(found.drill.type, ids, (type, part) => liveDrill(client, type, part)),
    liveCodes(client),
  ]);
  return rowsModel(
    {
      key: figure,
      value: found.value,
      ...(load ? { load } : {}),
      reply: drill,
      asOf: reply.asOf,
      machineCode: (id) => code(id) ?? undefined,
      ...(tile ? { named: tileName(tile, found) } : {}),
    },
    catalogue,
  );
}

/**
 * The figure the address names and the ids it counted; null when it is not ready or counted nothing. A block of one
 * machine's page counts that machine's own rows, not a whole figure's.
 */
function countedBy(
  figure: string,
  tile: ReturnType<typeof parseTile>,
  reply: Awaited<ReturnType<typeof liveReply>>,
) {
  const own = machineDrill(figure, reply);
  const listed = reply.figures.find((candidate) => candidate.key === (tile?.figure ?? figure));
  const found = own === null ? listed : { status: 'ready' as const, drill: own, value: null };
  const ids = listed && tile ? tileMachines(listed, tile) : (found?.drill.ids ?? []);
  if (found?.status !== 'ready' || ids.length === 0) return null;
  const load = own === null && listed ? energyLoad(listed) : undefined;
  return { found, ids, load };
}

/** What a tile of the energy map is called in the drawer, with its connected load: the words v1's panel had. */
function tileName(tile: NonNullable<ReturnType<typeof parseTile>>, found: { value?: unknown }) {
  const noCell = tile.tile === '—' ? catalogue('analytics.energy.noCell') : tile.tile;
  const label =
    tile.axis === 'location'
      ? catalogue('analytics.energy.drillLocation', { location: tile.tile })
      : catalogue('analytics.energy.drillCell', { cell: noCell });
  const extra = (found.value as { extra?: Record<string, unknown> } | null)?.extra;
  const grid = extra?.[tile.axis === 'cell' ? 'byCell' : 'byLocation'];
  const bucket = (Array.isArray(grid) ? grid : []).find(
    (candidate: { key?: unknown }) => candidate.key === tile.tile,
  ) as { totalKva?: number } | undefined;
  const kva = typeof bucket?.totalKva === 'number' ? oneDecimal(bucket.totalKva) : '';
  return { label, value: kva === '' ? '' : `${kva} ${catalogue('analytics.energy.unit')}` };
}
