import { defineModule } from '../../kernel/index.js';
import { registerIdentityRoutes } from './routes.js';

export {
  activePeople,
  activePerson,
  deleteTenantBySlug,
  ensurePendingPerson,
  insertPeople,
  insertTenant,
  jobTenantIds,
  lockTenantBySlug,
  listPeople,
  peopleByIds,
  purgeDeadSessions,
  redactionTerms,
  resolveTenant,
  tenantInfo,
  type NewPerson,
  type RedactionTerms,
  type TenantRow,
} from './repo.js';
export { setTenantLogo, tenantLogoId, updateTenantProfile } from './repo/profile.js';
export {
  clearActingPerson,
  disableLoginsOfPerson,
  endSessions,
  insertLogin,
  insertPerson,
  listLoginAdmin,
  listPersonAdmin,
  lockActivePerson,
  lockLiveActing,
  lockPerson,
  lockPeopleWrites,
  loginAdminById,
  loginsOfPerson,
  otherAdminCount,
  personAdminById,
  updateLogin,
  updatePerson,
  type ActingCheck,
  type LoginChange,
  type PersonFields,
} from './repo/people.js';
export { hashPassword } from './routes.js';
export {
  authenticate,
  hashToken,
  passwordMessage,
  refuseSupport,
  requireAuth,
  tenantSlugFromHost,
} from './service.js';
export {
  SUPPORT_WRITES,
  parseSupportKeys,
  supportAuthenticator,
  type SupportKeys,
} from './support-auth.js';

export const identityModule = defineModule({ name: 'identity', register: registerIdentityRoutes });
