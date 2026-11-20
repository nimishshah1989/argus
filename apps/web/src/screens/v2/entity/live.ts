import type { EntityRef } from '../../../ui/v2/entity-chip.js';
import type { ProviderContext } from '../data.js';
import { catalogue, liveConfig, liveOpen, liveReply } from '../figures/live.js';
import { entityModel } from './adapter.js';

/** The drawer's model from the plant's own lists, its open tickets and the engine's reply (the v1 queries and cache). */
export async function liveEntity(ref: EntityRef, { client }: ProviderContext) {
  if (ref.kind === 'decision') return null;
  const [config, open, reply] = await Promise.all([
    liveConfig(client),
    liveOpen(client),
    liveReply(client),
  ]);
  return entityModel(
    ref,
    { machines: config.machines, people: config.people, open, reply },
    catalogue,
  );
}
