import { defineModule } from '../../kernel/index.js';
import { registerIdentityRoutes } from './routes.js';

export { listPeople, resolveTenant, tenantInfo, type TenantRow } from './repo.js';
export { authenticate, hashToken, requireAuth, tenantSlugFromHost } from './service.js';

export const identityModule = defineModule({ name: 'identity', register: registerIdentityRoutes });
