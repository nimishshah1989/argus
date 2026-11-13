import type { ModuleDefinition } from '../kernel/index.js';
import { accountabilityModule } from './accountability/index.js';
import { filesModule } from './files/index.js';
import { identityModule } from './identity/index.js';
import { notificationsModule } from './notifications/index.js';
import { opsModule } from './ops/index.js';
import { plantModule } from './plant/index.js';
import { reportsModule } from './reports/index.js';

export const modules: readonly ModuleDefinition[] = [
  opsModule,
  identityModule,
  plantModule,
  filesModule,
  notificationsModule,
  accountabilityModule,
  reportsModule,
];
