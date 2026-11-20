import type { ScreenEntry } from '../data.js';
import type { MachinePageModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    /** One machine's own page; nothing when the code is not a machine of the plant. */
    machine: { params: { id: string }; model: MachinePageModel };
  }
}

export const screen: ScreenEntry<'machine'> = {
  key: 'machine',
  provider: ({ id }) => import('./fixture.js').then((m) => m.machineFixture(id)),
};
