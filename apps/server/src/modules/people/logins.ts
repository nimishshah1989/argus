import type { LoginAdmin, LoginCreate, LoginPatch } from '@uptimo/shared';
import {
  endSessions,
  hashPassword,
  insertLogin,
  loginAdminById,
  otherAdminCount,
  personAdminById,
  updateLogin,
} from '../identity/index.js';
import { deleteSubscriptionsOf } from '../notifications/index.js';
import { audit } from '../ops/index.js';
import {
  done,
  fail,
  lastAdmin,
  lockAsAdmin,
  weakPassword,
  type Actor,
  type Outcome,
  type Tx,
} from './outcome.js';

/** What an audit row keeps of a login: never the password or its hash. */
function loginSnapshot(l: LoginAdmin) {
  return {
    username: l.username,
    role: l.role,
    shared: l.shared,
    personId: l.personId,
    cell: l.cell,
    disabled: l.disabled,
    mustChangePassword: l.mustChangePassword,
  };
}

const SHARED_ADMIN = 'A shared login cannot be an admin: admin actions must name a person';

export async function createLogin(
  tx: Tx,
  actor: Actor,
  body: LoginCreate,
): Promise<Outcome<LoginAdmin>> {
  if (body.shared && body.role === 'admin') return fail(422, 'validation', SHARED_ADMIN, 'role');
  const weak = weakPassword(body.temporaryPassword, body.username, 'temporaryPassword');
  if (weak) return weak;
  const denied = await lockAsAdmin(tx, actor);
  if (denied) return denied;
  const personId = body.personId ?? null;
  if (personId) {
    const person = await personAdminById(tx, personId);
    if (!person) return fail(404, 'not_found', 'Unknown person', 'personId');
    if (!person.active) return fail(409, 'conflict', 'That person is switched off', 'personId');
  }
  const login = await insertLogin(
    tx,
    actor.tenantId,
    { username: body.username, role: body.role, personId, cell: body.cell ?? null },
    await hashPassword(body.temporaryPassword),
  );
  await audit.record(tx, {
    ...actor,
    action: 'login.create',
    entity: 'login',
    entityId: login.id,
    before: null,
    after: loginSnapshot(login),
  });
  return done(login, 201);
}

function loginAction(before: LoginAdmin, patch: LoginPatch): string {
  if (patch.disabled === true) return 'login.disable';
  if (patch.disabled === false && before.disabled) return 'login.enable';
  return patch.temporaryPassword ? 'login.reset_password' : 'login.update';
}

/** What a request may not ask for, judged from the request and the login as it stands. */
function loginPatchShape(before: LoginAdmin, patch: LoginPatch): Outcome<never> | null {
  if (before.shared && patch.role === 'admin') return fail(422, 'validation', SHARED_ADMIN, 'role');
  if (patch.cell && !before.shared)
    return fail(422, 'validation', 'Only a shared login has a cell', 'cell');
  if (patch.disabled === false && before.disabled && !patch.temporaryPassword)
    return fail(
      422,
      'validation',
      'Give a new temporary password to switch a login on',
      'temporaryPassword',
    );
  return patch.temporaryPassword
    ? weakPassword(patch.temporaryPassword, before.username, 'temporaryPassword')
    : null;
}

/** What the rest of the plant makes impossible: an off person, or no admin left. */
async function loginPatchConflict(tx: Tx, before: LoginAdmin, patch: LoginPatch) {
  const turningOn = patch.disabled === false && before.disabled;
  if (turningOn && before.personId && !(await personAdminById(tx, before.personId))?.active)
    return fail(409, 'conflict', 'Switch the person on first', 'disabled');
  const demoted = patch.role !== undefined && patch.role !== 'admin';
  const leaves =
    before.role === 'admin' && !before.disabled && (patch.disabled === true || demoted);
  return leaves && (await otherAdminCount(tx, [before.id])) === 0 ? lastAdmin() : null;
}

/** Ends every sign-in and phone of a login that was switched off or got a new password. */
async function endLoginAccess(tx: Tx, id: string, patch: LoginPatch) {
  const ends = patch.disabled === true || patch.temporaryPassword !== undefined;
  if (!ends) return undefined;
  return {
    sessionsEnded: await endSessions(tx, [id]),
    devicesRemoved: await deleteSubscriptionsOf(tx, [id]),
  };
}

/** One audit row for the request, unless it changed nothing. */
async function auditLoginChange(
  tx: Tx,
  actor: Actor,
  change: {
    before: LoginAdmin;
    after: LoginAdmin;
    patch: LoginPatch;
    effects?: { sessionsEnded: number; devicesRemoved: number };
  },
): Promise<void> {
  const { before, after, patch, effects } = change;
  const ended = (effects?.sessionsEnded ?? 0) + (effects?.devicesRemoved ?? 0) > 0;
  const same = JSON.stringify(loginSnapshot(before)) === JSON.stringify(loginSnapshot(after));
  if (!ended && same && patch.temporaryPassword === undefined) return;
  await audit.record(tx, {
    ...actor,
    action: loginAction(before, patch),
    entity: 'login',
    entityId: after.id,
    before: loginSnapshot(before),
    after: { ...loginSnapshot(after), ...effects },
  });
}

export async function patchLogin(
  tx: Tx,
  actor: Actor,
  id: string,
  patch: LoginPatch,
): Promise<Outcome<LoginAdmin>> {
  const denied = await lockAsAdmin(tx, actor);
  if (denied) return denied;
  const before = await loginAdminById(tx, id);
  if (!before) return fail(404, 'not_found', 'Unknown login');
  const refusal = loginPatchShape(before, patch) ?? (await loginPatchConflict(tx, before, patch));
  if (refusal) return refusal;
  const after = await updateLogin(tx, id, {
    role: patch.role,
    cell: patch.cell,
    disabled: patch.disabled,
    passwordHash: patch.temporaryPassword && (await hashPassword(patch.temporaryPassword)),
  });
  // Written first, so a sign-in being made right now has finished and is ended here, whatever it was.
  const effects = await endLoginAccess(tx, id, patch);
  await auditLoginChange(tx, actor, { before, after, patch, effects });
  return done(after);
}
