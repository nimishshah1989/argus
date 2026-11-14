import type { PersonAdmin, PersonCreate, PersonPatch } from '@uptimo/shared';
import {
  clearActingPerson,
  disableLoginsOfPerson,
  endSessions,
  insertPerson,
  loginsOfPerson,
  lockPerson,
  otherAdminCount,
  personAdminById,
  updatePerson,
} from '../identity/index.js';
import { clearSubscriptionPerson, deleteSubscriptionsOf } from '../notifications/index.js';
import { audit } from '../ops/index.js';
import { activeTicketRefsOfPerson } from '../tickets/index.js';
import {
  done,
  fail,
  lastAdmin,
  lockAsAdmin,
  type Actor,
  type Outcome,
  type Tx,
} from './outcome.js';

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

export async function createPerson(
  tx: Tx,
  actor: Actor,
  body: PersonCreate,
): Promise<Outcome<PersonAdmin>> {
  const denied = await lockAsAdmin(tx, actor);
  if (denied) return denied;
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
  /** Sign-ins on a shared phone that no longer act as this person (the sign-in itself stays). */
  actingCleared: number;
  /** Registrations on a shared phone that no longer send this person's notifications. */
  devicesDetached: number;
  loginsDisabled: string[];
}

const touched = (e: Effects): number =>
  e.sessionsEnded +
  e.devicesRemoved +
  e.actingCleared +
  e.devicesDetached +
  e.loginsDisabled.length;

/** Why this person may not be switched off now: tickets still in progress, or the last admin. */
async function switchOffRefusal(tx: Tx, person: PersonAdmin): Promise<Outcome<never> | null> {
  const refs = await activeTicketRefsOfPerson(tx, person.id);
  if (refs.length > 0)
    return fail(
      409,
      'conflict',
      `${person.name} is on tickets in progress (${refs.join(', ')}). Transfer or close them first`,
      'active',
    );
  const logins = await loginsOfPerson(tx, person.id);
  const admins = logins.filter((l) => l.role === 'admin' && !l.disabled).map((l) => l.id);
  return admins.length > 0 && (await otherAdminCount(tx, admins)) === 0 ? lastAdmin() : null;
}

/**
 * Everything a person's logins and phones can still do, undone. Personal sign-ins and registrations end; a
 * shared phone keeps both, minus this person. Runs after the person row is written, so a sign-in that was
 * being made when the switch-off began has finished by now and is ended here.
 */
async function endAccess(tx: Tx, personId: string, disable: boolean): Promise<Effects> {
  const loginIds = (await loginsOfPerson(tx, personId)).map((l) => l.id);
  const loginsDisabled = disable ? await disableLoginsOfPerson(tx, personId) : [];
  const sessionsEnded = await endSessions(tx, loginIds);
  const devicesRemoved = await deleteSubscriptionsOf(tx, loginIds);
  const actingCleared = disable ? await clearActingPerson(tx, personId) : 0;
  const devicesDetached = disable ? await clearSubscriptionPerson(tx, personId) : 0;
  return { sessionsEnded, devicesRemoved, actingCleared, devicesDetached, loginsDisabled };
}

function personAction(before: PersonAdmin, patch: PersonPatch): string {
  if (patch.active === false) return 'person.switch_off';
  return patch.active === true && !before.active ? 'person.switch_on' : 'person.update';
}

/** A switched-off person has no number; a number goes on only together with switching them on. */
function personPatchRefusal(before: PersonAdmin, patch: PersonPatch): Outcome<never> | null {
  if (!patch.phone) return null;
  if (patch.active === false)
    return fail(422, 'validation', 'A switched-off person has no phone number', 'phone');
  return !before.active && patch.active !== true
    ? fail(409, 'conflict', 'Switch the person on before giving them a number', 'phone')
    : null;
}

/** One audit row for the request, unless it changed nothing. */
async function auditPersonChange(
  tx: Tx,
  actor: Actor,
  change: { before: PersonAdmin; after: PersonAdmin; patch: PersonPatch; effects?: Effects },
): Promise<void> {
  const { before, after, effects } = change;
  const phoneChanged = before.phone !== after.phone;
  const unchanged =
    JSON.stringify(before) === JSON.stringify(after) && (!effects || touched(effects) === 0);
  if (unchanged) return;
  await audit.record(tx, {
    ...actor,
    action: personAction(before, change.patch),
    entity: 'person',
    entityId: after.id,
    before: personSnapshot(before),
    after: { ...personSnapshot(after), ...(phoneChanged && { phoneChanged }), ...effects },
  });
}

export async function patchPerson(
  tx: Tx,
  actor: Actor,
  id: string,
  patch: PersonPatch,
): Promise<Outcome<PersonAdmin>> {
  const denied = await lockAsAdmin(tx, actor);
  if (denied) return denied;
  // Held until commit: a command putting this person on a ticket has finished (or waits) before we look.
  await lockPerson(tx, id);
  const before = await personAdminById(tx, id);
  if (!before) return fail(404, 'not_found', 'Unknown person');
  const off = patch.active === false;
  const on = patch.active === true && !before.active;
  const refusal =
    personPatchRefusal(before, patch) ??
    (off && before.active ? await switchOffRefusal(tx, before) : null);
  if (refusal) return refusal;
  const after = await updatePerson(tx, id, off ? { ...patch, phone: null } : patch);
  const effects = off || on ? await endAccess(tx, id, off) : undefined;
  await auditPersonChange(tx, actor, { before, after, patch, effects });
  return done(after);
}
