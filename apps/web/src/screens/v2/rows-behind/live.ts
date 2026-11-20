import { MAX_DRILL_IDS, type DrillReply, type DrillType } from '@uptimo/shared/analytics';
import type { ProviderContext } from '../data.js';
import { catalogue, liveCodes, liveDrill, liveReply } from '../figures/live.js';
import { rowsModel } from './model.js';

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
  const found = reply.figures.find((candidate) => candidate.key === figure);
  if (found?.status !== 'ready' || found.drill.ids.length === 0) return null;
  const [drill, code] = await Promise.all([
    rowsOf(found.drill.type, found.drill.ids, (type, ids) => liveDrill(client, type, ids)),
    liveCodes(client),
  ]);
  return rowsModel(
    {
      key: figure,
      value: found.value,
      reply: drill,
      asOf: reply.asOf,
      machineCode: (id) => code(id) ?? undefined,
    },
    catalogue,
  );
}
