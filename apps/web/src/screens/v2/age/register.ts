import type { ScreenEntry } from '../data.js';
import type { AgeModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    age: { params: Record<string, never>; model: AgeModel };
  }
}

export const screen: ScreenEntry<'age'> = {
  key: 'age',
  provider: async () => {
    const [{ liveReply, catalogue }, { ageModel }] = await Promise.all([
      import('../figures/live.js'),
      import('./adapter.js'),
    ]);
    return ageModel(await liveReply(), catalogue);
  },
};
