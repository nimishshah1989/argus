import type { ScreenEntry } from '../data.js';
import type { BoardModel, BoardQuery } from './model.js';

declare module '../data.js' {
  interface Screens {
    board: { params: BoardQuery; model: BoardModel };
  }
}

export const screen: ScreenEntry<'board'> = {
  key: 'board',
  // Live: `/state`, `/config` and `/board/today` through the query client, then `boardModel`.
  provider: () => Promise.reject(new Error('not implemented')),
  frozen: (query) => import('./fixture.js').then((m) => m.boardFixture(query.tv)),
};
