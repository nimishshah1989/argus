import type { ScreenEntry } from '../data.js';
import type { RowsBehindModel } from '../../../ui/v2/domain/rows-behind.js';

declare module '../data.js' {
  interface Screens {
    /** The rows behind one figure (`?drawer=figure:<key>`), for the drawer on any screen; nothing when the figure counts none. */
    'rows-behind': { params: { figure: string }; model: RowsBehindModel };
  }
}

export const screen: ScreenEntry<'rows-behind'> = {
  key: 'rows-behind',
  provider: ({ figure }, ctx) => import('./live.js').then((m) => m.liveRows(figure, ctx)),
  frozen: ({ figure }) => import('./frozen.js').then((m) => m.frozenRows(figure)),
};
