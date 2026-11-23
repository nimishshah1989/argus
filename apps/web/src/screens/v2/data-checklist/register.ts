import i18n from 'i18next';
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
  provider: async (_query, { client }) => {
    const [{ liveReply }, { liveChecklist }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return liveChecklist(await liveReply(client), i18n.t.bind(i18n));
  },
  frozen: () => import('./fixture.js').then((m) => m.dataChecklistFixture),
};
