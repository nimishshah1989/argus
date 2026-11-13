import { defineModule } from '../../kernel/index.js';
import { registerIdentityRoutes } from './routes.js';

export {
  activePeople,
  activePerson,
  deleteTenantBySlug,
  ensurePendingPerson,
  insertPeople,
  insertTenant,
  listPeople,
  peopleByIds,
  redactionTerms,
  resolveTenant,
  tenantInfo,
  type NewPerson,
  type RedactionTerms,
  type TenantRow,
} from './repo.js';
export { hashPassword } from './routes.js';
export { authenticate, hashToken, requireAuth, tenantSlugFromHost } from './service.js';

export const identityModule = defineModule({ name: 'identity', register: registerIdentityRoutes });
