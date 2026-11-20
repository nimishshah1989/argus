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
    const [{ liveReply }, { problemAnalysisFromReply }, { requireComputed }] = await Promise.all([
      import('../figures/live.js'),
      import('./live.js'),
      import('../figures/computed.js'),
    ]);
    const reply = await liveReply(client);
    requireComputed(reply, 'a10-problems');
    return problemAnalysisFromReply(reply);
  },
  frozen: () => import('./source.js').then((m) => m.problemAnalysisFromKey()),
};
