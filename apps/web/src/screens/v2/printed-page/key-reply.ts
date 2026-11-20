import type { FiguresPart } from './printed.js';

/**
 * The engine's frozen answer for one figure (`fixtures/answer-key/<key>.json`, the 11 November plant, already in the
 * repo and pinned equal to the engine's output by the domain tests) as the part of the figures reply an adapter reads.
 * The gallery and the tests use it; the live screen reads the same shape from `GET /analytics/figures`.
 */
export function keyReply(
  key: string,
  owner: number,
  value: { asOf: string },
  drillType: 'ticket' | 'machine' = 'ticket',
): FiguresPart {
  return {
    asOf: value.asOf,
    figures: [
      { key, screen: key, owner, status: 'ready', value, drill: { type: drillType, ids: [] } },
    ],
  };
}
