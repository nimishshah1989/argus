import type { ScreenEntry } from '../data.js';
import type { OpenInput, OpenModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    desk: { params: Pick<OpenInput, 'filter' | 'segment'>; model: OpenModel };
  }
}

/**
 * The desk's Open screen. `frozen` is `openModel` over `fixture.ts` (the gallery's and the insight-coverage test's
 * answer); `provider` builds the same model from the query client's `/state`, `/config` and `/auth/me`.
 */
export const screen: ScreenEntry<'desk'> = {
  key: 'desk',
  provider: () => Promise.reject(new Error('not implemented')),
  frozen: () => Promise.reject(new Error('not implemented')),
};
