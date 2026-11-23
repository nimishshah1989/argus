import type { ScreenEntry } from '../data.js';
import type { TeamFocusModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'team-focus': { params: Record<string, never>; model: TeamFocusModel };
  }
}

export const screen: ScreenEntry<'team-focus'> = {
  key: 'team-focus',
  provider: async (_, { client }) => {
    const [{ default: i18n }, { focusNotesQuery }, figures, live, { drillFor }] = await Promise.all(
      [
        import('i18next'),
        import('../../../api.js'),
        import('../figures/live.js'),
        import('./live.js'),
        import('../rows-behind/drill.js'),
      ],
    );
    const reply = await figures.liveReply(client);
    const period = live.focusPeriod(reply);
    const notes = period ? (await figures.read(client, focusNotesQuery(period))).notes : {};
    return {
      ...live.liveTeamFocus(reply, notes, i18n.t.bind(i18n)),
      drill: drillFor(reply, live.KEY, figures.catalogue),
    };
  },
};
