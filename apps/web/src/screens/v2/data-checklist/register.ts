import type { ScreenEntry } from '../data.js';
import type { DataChecklistModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'data-checklist': { params: Record<string, never>; model: DataChecklistModel };
  }
}

/**
 * The app runs the live checklist (DC-2, ADR 0019): `liveChecklist(await liveReply(client), i18n.t.bind(i18n))`, both
 * loaded with `import()` as `breakdown-log/register.ts` does. The gallery keeps the approved fixture as its frozen answer.
 */
export const screen: ScreenEntry<'data-checklist'> = {
  key: 'data-checklist',
  provider: () => Promise.reject(new Error('not built: DC-2 live provider (#578)')),
  frozen: () => import('./fixture.js').then((m) => m.dataChecklistFixture),
};
