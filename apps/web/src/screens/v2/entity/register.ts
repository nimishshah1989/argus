import type { ScreenEntry } from '../data.js';
import type { EntityRef } from '../../../ui/v2/entity-chip.js';
import type { EntityModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    /** One machine, cell, person or decision, for the drawer on any screen; nothing when it is not found. */
    entity: { params: EntityRef; model: EntityModel };
  }
}

export const screen: ScreenEntry<'entity'> = {
  key: 'entity',
  provider: (ref) => import('./fixture.js').then((m) => m.entityFixture(ref)),
};
