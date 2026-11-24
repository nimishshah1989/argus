import type { TFunction } from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import type { MoneyMattersModel } from './model.js';

/** The engine's figure this screen is built from (page `mm`); the server leaves it out for a login without money rights. */
export const FIGURE = 'money-matters';

/**
 * S22 from the engine reply. `money` false (v1 `mayReadMoney`) is the refusal, whatever the reply holds; otherwise null
 * when the figure is missing or not ready, never an invented figure. Skeleton: built by ticket 644.
 */
export function moneyMattersModel(
  _reply: FiguresPart,
  _t: TFunction,
  _viewer: { money: boolean },
): MoneyMattersModel | null {
  throw new Error('not built yet: ticket 644');
}
