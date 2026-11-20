import type { FiguresReply } from '@uptimo/shared/analytics';
import { NotComputed } from './live-error.js';

/**
 * A figure the engine did not compute says so (`analytics.notComputed`, as v1 did), which is not the same as a figure
 * that was computed and has nothing in it. A screen's provider asks here before it adapts, so the two stay apart.
 */
export function requireComputed(reply: Pick<FiguresReply, 'figures'>, key: string): void {
  if (reply.figures.find((figure) => figure.key === key)?.status !== 'ready')
    throw new NotComputed();
}
