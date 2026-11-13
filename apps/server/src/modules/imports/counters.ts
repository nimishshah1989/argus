import { raiseRefCounter, refCounterRows, ticketRefsLike } from '../tickets/index.js';
import type { ImportCtx } from './batch.js';
import type { PlannedRow } from './identity.js';

const MAX_REF = 2_147_483_646;

function suffix(ref: string, prefix: 'BD' | 'WR'): number | null {
  const match = new RegExp(`^${prefix}-([0-9]+)$`).exec(ref);
  if (!match || (match[1] as string).length > 10) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : null;
}

async function prefixMaximum(
  ctx: ImportCtx,
  prefix: 'BD' | 'WR',
  plans: PlannedRow[],
): Promise<number> {
  const [counter, tickets] = await Promise.all([
    refCounterRows(ctx.client, ctx.tenantId, prefix),
    ticketRefsLike(ctx.client, ctx.tenantId, `${prefix}-%`),
  ]);
  let maximum = counter[0] ? Number(counter[0].next_value) - 1 : 0;
  const refs = [
    ...tickets.map((row) => row.ref as string),
    ...plans
      .filter((row) => row.outcome !== 'error' && row.ticket)
      .map((row) => row.ticket?.ref as string),
  ];
  for (const ref of refs) {
    const value = suffix(ref, prefix);
    if (value !== null) maximum = Math.max(maximum, value);
  }
  return maximum;
}

export async function advanceRefCounters(
  ctx: ImportCtx,
  plans: PlannedRow[],
): Promise<{ BD: number; WR: number }> {
  const result = { BD: 0, WR: 0 };
  for (const prefix of ['BD', 'WR'] as const) {
    const maximum = await prefixMaximum(ctx, prefix, plans);
    if (maximum > MAX_REF) throw new Error(`${prefix} reference counter is exhausted`);
    const next = maximum + 1;
    await raiseRefCounter(ctx.client, { tenantId: ctx.tenantId, prefix, next });
    result[prefix] = next;
  }
  return result;
}
