import { defineModule } from '../../kernel/index.js';
import { registerIdentityRoutes } from './routes.js';

export {
  activePerson,
  deleteTenantBySlug,
  insertPeople,
  insertTenant,
  listPeople,
  peopleByIds,
  resolveTenant,
  tenantInfo,
  type NewPerson,
  type TenantRow,
} from './repo.js';
export { hashPassword } from './routes.js';
export { authenticate, hashToken, requireAuth, tenantSlugFromHost } from './service.js';

export const identityModule = defineModule({ name: 'identity', register: registerIdentityRoutes });
