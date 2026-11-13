import type { ModuleDefinition } from '../kernel/index.js';
import { identityModule } from './identity/index.js';
import { opsModule } from './ops/index.js';

export const modules: readonly ModuleDefinition[] = [opsModule, identityModule];
