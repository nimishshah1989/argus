import type { PoolClient } from 'pg';
import { canLiveBoard } from '@uptimo/domain';
import { actorOf } from './actor.js';
import { setting } from './repo/reads.js';

/** Whether this login may see the live board: everyone but an operator, who sees it when the plant's floor is live. */
export async function mayViewBoard(
  client: PoolClient,
  ctx: {
    tenantId: string;
    role: string;
    loginId: string;
    personId: string | null;
    shared: boolean;
  },
): Promise<boolean> {
  const features = (await setting(client, ctx.tenantId, 'features')) as
    { floorLive?: unknown } | undefined;
  return canLiveBoard(actorOf(ctx), features?.floorLive === true);
}
