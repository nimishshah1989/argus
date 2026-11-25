import type { TFunction } from 'i18next';
import type { BoardToday, Config, State } from '../../../api.js';
import type { BoardModel } from './model.js';

/** What the board reads: `/state`, `/config` and `/board/today` (missing while it loads or when it is refused). */
export interface BoardInput {
  state: State;
  config: Config;
  today: BoardToday | undefined;
  tv: boolean;
}

/** "Tue 24 Nov" in the plant's time zone. */
export function dayLabel(iso: string, timeZone?: string): string {
  void iso;
  void timeZone;
  throw new Error('not implemented');
}

/** The replies → the board's model, through `liveBoard()` of `screens/board/data.ts` (kept, not copied). */
export function boardModel(input: BoardInput, t: TFunction): BoardModel {
  void input;
  void t;
  throw new Error('not implemented');
}
