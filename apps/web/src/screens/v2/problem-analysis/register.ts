import type { ScreenEntry } from '../data.js';
import type { ProblemAnalysisModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    'problem-analysis': { params: Record<string, never>; model: ProblemAnalysisModel };
  }
}

export const screen: ScreenEntry<'problem-analysis'> = {
  key: 'problem-analysis',
  provider: () => import('./source.js').then((m) => m.problemAnalysisFromKey()),
};
