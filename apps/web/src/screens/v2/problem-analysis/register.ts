import type { ScreenEntry } from '../data.js';
import type { ProblemAnalysisModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'problem-analysis': { params: Record<string, never>; model: ProblemAnalysisModel };
  }
}

export const screen: ScreenEntry<'problem-analysis'> = {
  key: 'problem-analysis',
  provider: async (_, { client }) => {
    const [{ liveReply }, { problemAnalysisFromReply }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
    ]);
    return problemAnalysisFromReply(await liveReply(client));
  },
  frozen: () => import('./source.js').then((m) => m.problemAnalysisFromKey()),
};
