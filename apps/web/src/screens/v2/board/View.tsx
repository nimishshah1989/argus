import type { ReactNode } from 'react';
import type { BoardModel } from './model.js';

/**
 * The board drawn from its model: phone/desktop (nav, h1, "Updated", sync pill, pulse card, columns, ages card, day
 * tiles) or the TV (no link at all, sr-only h1, clock, 16:9 frame). `offline` adds the TV's "last numbers kept" line.
 */
export function BoardView(props: { model: BoardModel; offline?: boolean }): ReactNode {
  void props;
  throw new Error('not implemented');
}
