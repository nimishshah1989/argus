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
  peopleForEngine,
  personCode,
  purgeDeadSessions,
  redactionTerms,
  resolveTenant,
  tenantInfo,
  type NewPerson,
  type RedactionTerms,
  type TenantRow,
} from './repo.js';
export {
  ErasedPersonError,
  ErasureKeyMissing,
  erasedNamesAmong,
  erasePerson,
  erasureHash,
  erasureNameHash,
  refuseErasedEdit,
  normaliseName,
  normalisePhone,
  refuseErased,
} from './repo/erasure.js';
export { nameCodes, personNames, redactionCodes } from './repo/names.js';
export { actingTeams, listActingChoices, type ActingChoice } from './repo/acting.js';
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
  loginNames,
  loginsOfPerson,
  otherAdminCount,
  peopleWithRole,
  personAdminById,
  updateLogin,
  updatePerson,
  type ActingCheck,
  type LoginChange,
  type PersonFields,
} from './repo/people.js';
export { lockLiveSession } from './repo/session.js';
export { hashPassword } from './routes.js';
export {
  SUPPORT_NOT_ALLOWED,
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
export { createRedactor, type AiJson, type Redactor } from './redact.js';
