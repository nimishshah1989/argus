import type { PoolClient } from 'pg';
import { passwordProblem } from '@uptimo/domain';
import {
  apiError,
  type ErrorBody,
  type ErrorCode,
  type LoginAdmin,
  type LoginCreate,
  type LoginPatch,
  type PersonAdmin,
  type PersonCreate,
  type PersonPatch,
} from '@uptimo/shared';
import {
  disableLoginsOfPerson,
  endSessions,
  hashPassword,
  insertLogin,
  insertPerson,
  lockPeopleWrites,
  loginAdminById,
  loginsOfPerson,
  otherAdminCount,
  passwordMessage,
  personAdminById,
  updateLogin,
  updatePerson,
} from '../identity/index.js';
import { deleteSubscriptionsOf } from '../notifications/index.js';
import { audit } from '../ops/index.js';

type Tx = Pick<PoolClient, 'query'>;
export interface Actor {
  tenantId: string;
  loginId: string;
}
export type Outcome<T> =
  { ok: true; status: 200 | 201; value: T } | { ok: false; status: number; error: ErrorBody };

const done = <T>(value: T, status: 200 | 201 = 200): Outcome<T> => ({ ok: true, status, value });
const fail = (
  status: number,
  code: ErrorCode,
  message: string,
  field?: string,
): Outcome<never> => ({ ok: false, status, error: apiError(code, message, field) });

const lastAdmin = () =>
  fail(409, 'conflict', 'At least one admin login must stay switched on', 'role');

function weakPassword(password: string, username: string, field: string): Outcome<never> | null {
  const problem = passwordProblem(password, username);
  return problem ? fail(400, 'validation', passwordMessage(problem), field) : null;
}

/** What an audit row keeps of a person: never the number itself, only its last four digits. */
function personSnapshot(p: PersonAdmin) {
  return {
    name: p.name,
    shortName: p.shortName,
    team: p.team,
    kind: p.kind,
    title: p.title,
    cell: p.cell,
    defaultShift: p.defaultShift,
    active: p.active,
    phoneEnding: p.phone ? p.phone.slice(-4) : null,
  };
}

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

export async function createPerson(
  tx: Tx,
  actor: Actor,
  body: PersonCreate,
): Promise<Outcome<PersonAdmin>> {
  const person = await insertPerson(tx, actor.tenantId, body);
  await audit.record(tx, {
    ...actor,
    action: 'person.create',
    entity: 'person',
    entityId: person.id,
    before: null,
    after: personSnapshot(person),
  });
  return done(person, 201);
}

interface Effects {
  sessionsEnded: number;
  devicesRemoved: number;
}

/** Ends every live sign-in and deletes every registered device of these logins (and of this acting person). */
async function endAccess(
  tx: Tx,
  who: { loginIds: string[]; actingPersonId?: string },
): Promise<Effects> {
  return {
    sessionsEnded: await endSessions(tx, who),
    devicesRemoved: await deleteSubscriptionsOf(tx, who),
  };
}

async function switchOff(tx: Tx, before: PersonAdmin) {
  const logins = await loginsOfPerson(tx, before.id);
  const admins = logins.filter((l) => l.role === 'admin' && !l.disabled).map((l) => l.id);
  if (admins.length > 0 && (await otherAdminCount(tx, admins)) === 0) return null;
  const loginsDisabled = await disableLoginsOfPerson(tx, before.id);
  const ended = await endAccess(tx, {
    loginIds: logins.map((l) => l.id),
    actingPersonId: before.id,
  });
  return { ...ended, loginsDisabled };
}

function personAction(before: PersonAdmin, patch: PersonPatch): string {
  if (patch.active === false) return 'person.switch_off';
  return patch.active === true && !before.active ? 'person.switch_on' : 'person.update';
}

/** A switched-off person has no number; a number goes on only together with switching them on. */
function personPatchRefusal(before: PersonAdmin, patch: PersonPatch): Outcome<never> | null {
  if (!patch.phone) return null;
  if (patch.active === false)
    return fail(400, 'validation', 'A switched-off person has no phone number', 'phone');
  return !before.active && patch.active !== true
    ? fail(409, 'conflict', 'Switch the person on before giving them a number', 'phone')
    : null;
}

export async function patchPerson(
  tx: Tx,
  actor: Actor,
  id: string,
  patch: PersonPatch,
): Promise<Outcome<PersonAdmin>> {
  await lockPeopleWrites(tx, actor.tenantId);
  const before = await personAdminById(tx, id);
  if (!before) return fail(404, 'not_found', 'Unknown person');
  const refusal = personPatchRefusal(before, patch);
  if (refusal) return refusal;
  const effects = patch.active === false ? await switchOff(tx, before) : undefined;
  if (effects === null) return lastAdmin();
  const fields = patch.active === false ? { ...patch, phone: null } : patch;
  const after = await updatePerson(tx, id, fields);
  const touched = effects
    ? effects.sessionsEnded + effects.devicesRemoved + effects.loginsDisabled.length
    : 0;
  if (touched > 0 || JSON.stringify(before) !== JSON.stringify(after))
    await audit.record(tx, {
      ...actor,
      action: personAction(before, patch),
      entity: 'person',
      entityId: id,
      before: personSnapshot(before),
      after: { ...personSnapshot(after), ...effects },
    });
  return done(after);
}

export async function createLogin(
  tx: Tx,
  actor: Actor,
  body: LoginCreate,
): Promise<Outcome<LoginAdmin>> {
  const weak = weakPassword(body.temporaryPassword, body.username, 'temporaryPassword');
  if (weak) return weak;
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
  if (patch.cell && !before.shared)
    return fail(400, 'validation', 'Only a shared login has a cell', 'cell');
  if (patch.disabled === false && before.disabled && !patch.temporaryPassword)
    return fail(
      400,
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

export async function patchLogin(
  tx: Tx,
  actor: Actor,
  id: string,
  patch: LoginPatch,
): Promise<Outcome<LoginAdmin>> {
  await lockPeopleWrites(tx, actor.tenantId);
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
  const ends = patch.disabled === true || patch.temporaryPassword !== undefined;
  const effects = ends ? await endAccess(tx, { loginIds: [id] }) : undefined;
  const touched = effects ? effects.sessionsEnded + effects.devicesRemoved : 0;
  const changed =
    touched > 0 ||
    patch.temporaryPassword !== undefined ||
    JSON.stringify(loginSnapshot(before)) !== JSON.stringify(loginSnapshot(after));
  if (changed)
    await audit.record(tx, {
      ...actor,
      action: loginAction(before, patch),
      entity: 'login',
      entityId: id,
      before: loginSnapshot(before),
      after: { ...loginSnapshot(after), ...effects },
    });
  return done(after);
}
