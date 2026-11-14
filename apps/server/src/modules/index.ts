import type { ModuleDefinition } from '../kernel/index.js';
import { accountabilityModule } from './accountability/index.js';
import { aiModule } from './ai/index.js';
import { analyticsModule } from './analytics/index.js';
import { filesModule } from './files/index.js';
import { identityModule } from './identity/index.js';
import { importsModule } from './imports/index.js';
import { notificationsModule } from './notifications/index.js';
import { opsModule } from './ops/index.js';
import { peopleModule } from './people/index.js';
import { plantModule } from './plant/index.js';
import { reportsModule } from './reports/index.js';
import { ticketsModule } from './tickets/index.js';

export const modules: readonly ModuleDefinition[] = [
  opsModule,
  identityModule,
  plantModule,
  peopleModule,
  filesModule,
  notificationsModule,
  ticketsModule,
  accountabilityModule,
  reportsModule,
  importsModule,
  aiModule,
  analyticsModule,
];
