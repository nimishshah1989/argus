import { defineModule } from '../../kernel/index.js';
import { registerIdentityRoutes } from './routes.js';

export {
  deleteTenantBySlug,
  insertPeople,
  insertTenant,
  listPeople,
  resolveTenant,
  tenantInfo,
  type NewPerson,
  type TenantRow,
} from './repo.js';
export { hashPassword } from './routes.js';
export { authenticate, hashToken, requireAuth, tenantSlugFromHost } from './service.js';

export const identityModule = defineModule({ name: 'identity', register: registerIdentityRoutes });
