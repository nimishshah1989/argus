import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import * as shared from '@uptimo/shared';
import * as domain from '@uptimo/domain';
import { requireAuth } from '../identity/index.js';
import { machinesByIds } from '../plant/index.js';
import { actingRefusal, ticketPartsAfterWrite } from '../../kernel/index.js';
import * as tm from './mapper.js';
import * as sql from './repo/ticket.js';
import * as idem from './repo/idempotency.js';
import { ALREADY_OPEN, runOutcome } from './outcome.js';
import { openDuplicateId } from './repo/list.js';
import { machineSwitchedOff } from './admin-fixes.js';
import { holdStartForLockout, lockoutField } from './lockout.js';
import { buildRaiseExtras, buildRaised, loadSeverityMatrix } from './severity.js';
import type { Auth, Outcome } from './routes.js';

/** `POST /api/v1/tickets`: who may raise, the machine check and the write, replayed on a repeated key. */

interface RaiseTx {
  tenantId: string;
  key: string;
  auth: Auth;
  body: Record<string, unknown>;
}

async function validateMachine(
  client: PoolClient,
  tx: RaiseTx,
): Promise<{ snapshot: Record<string, unknown>; criticality: string | null } | Outcome> {
  await sql.lockRefCounter(client, tx.tenantId, 'BD');
  if (!tx.body.machineId) return { snapshot: {}, criticality: null };
  const machine = (
    await machinesByIds(client, tx.tenantId, [tx.body.machineId as string], 'share')
  )[0];
  if (!machine)
    return { status: 404, body: shared.apiError('not_found', 'Unknown machine', 'machineId') };
  // A phone holding an old copy of the config may still offer a machine that has since been switched off.
  if (machine.status === 'scrapped') return machineSwitchedOff('machineId');
  const duplicate = await openDuplicateId(client, tx.tenantId, tx.body.machineId as string);
  if (duplicate) return ALREADY_OPEN;
  const { code, category, cell, criticality } = machine;
  return { snapshot: { code, category, cell, criticality }, criticality };
}

/**
 * Who a raise may name. The one who starts the work is the person acting, and only maintenance starts work; a
 * reporter other than the person acting (a technician taking a call) is for maintenance too, an operator reports as
 * themselves. Refused before anything is looked up, so a refusal says nothing about who exists.
 */
function raiseRefusal(tx: RaiseTx): Outcome | null {
  const { role, loginId, personId, shared: sharedLogin } = tx.auth;
  const maintenance = domain.canWork({
    role: role as domain.Role,
    loginId,
    personId,
    shared: sharedLogin,
  });
  if (tx.body.startNow || tx.body.startByPersonId !== undefined) {
    const named = tx.body.startByPersonId as string | undefined;
    const refused = actingRefusal(tx.auth, named, 'startByPersonId');
    if (refused) return refused;
    if (tx.body.startNow && !maintenance) {
      return {
        status: 403,
        body: shared.apiError(
          'forbidden',
          'You do not have permission for this action',
          'startNow',
        ),
      };
    }
  }
  const reporter = tx.body.reportedByPersonId as string | undefined;
  if (reporter !== undefined && reporter !== personId && !maintenance) {
    return {
      status: 403,
      body: shared.apiError('forbidden', 'You may only report as yourself', 'reportedByPersonId'),
    };
  }
  return null;
}

async function validateRaisePeople(
  client: PoolClient,
  tx: RaiseTx,
): Promise<{ reportedByPersonId: string | null } | Outcome> {
  const refused = raiseRefusal(tx);
  if (refused) return refused;
  const reportedByPersonId = (tx.body.reportedByPersonId as string | undefined) ?? tx.auth.personId;
  if (reportedByPersonId && !(await sql.personExists(client, tx.tenantId, reportedByPersonId))) {
    return {
      status: 404,
      body: shared.apiError('not_found', 'Unknown reporter', 'reportedByPersonId'),
    };
  }
  // Starting at the raise names a person who starts; a flagged work type is held open for its lockout instead.
  await holdStartForLockout(client, tx);
  return { reportedByPersonId };
}

async function executeRaise(
  client: PoolClient,
  tx: RaiseTx,
  binding: idem.IdempotencyBinding,
  boss?: PgBoss,
): Promise<Outcome> {
  const existing = await idem.getIdempotent(client, binding);
  if (existing) return existing;
  const machine = await validateMachine(client, tx);
  // A same-key raise may have committed in between: replay its stored result, not a duplicate error.
  if ('status' in machine) return (await idem.getIdempotent(client, binding)) ?? machine;
  const people = await validateRaisePeople(client, tx);
  if ('status' in people) return people;
  const ref = await sql.allocateRef(client, tx.tenantId, String(tx.body.kind));
  const now = new Date();
  const severityMatrix = await loadSeverityMatrix(client, tx.tenantId);
  const criticality = machine.criticality as domain.Criticality | null;
  const raised = buildRaised({
    ref,
    body: { ...tx.body, startByPersonId: tx.auth.personId ?? undefined },
    loginId: tx.auth.loginId,
    reportedByPersonId: people.reportedByPersonId,
    now,
    criticality,
    severityMatrix,
  });
  raised.ticket.figures = tm.recomputeFigures(raised.ticket, raised.events, raised.segments, {
    overrides: {},
    now,
  });
  const extras = buildRaiseExtras(machine.snapshot, tx.body, criticality, severityMatrix);
  await sql.insertTicket(client, tx.tenantId, raised.ticket, extras);
  await sql.persistEvents(client, tx.tenantId, raised.ticket.id, {
    events: raised.events,
    startSeq: 0,
    idempotencyKey: tx.key,
    loginId: tx.auth.loginId,
    actingPersonId: tx.auth.personId,
    textFor: () => tx.body.problem as string,
  });
  await sql.persistSegments(client, tx.tenantId, raised.ticket.id, { ...raised, endReason: null });
  const parts = await ticketPartsAfterWrite(client, {
    tenantId: tx.tenantId,
    ticketId: raised.ticket.id,
    now,
    boss,
    command: 'raise',
    actor: tx.auth,
  });
  const lockout = await lockoutField(client, tx, raised.ticket.id);
  const outcome: Outcome = {
    status: 201,
    body: { ticket: { ...tm.ticketProjection(raised.ticket, extras), ...parts, ...lockout } },
  };
  await idem.storeIdempotent(client, { ...binding, command: 'raise', result: outcome });
  return outcome;
}

export async function raise(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
  boss?: PgBoss,
): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const key = idem.idempotencyKey(request.headers);
  if (!key) {
    reply.code(422).send(shared.apiError('validation', idem.KEY_REQUIRED, 'idempotencyKey'));
    return;
  }
  const parsed = shared.raiseTicketSchema.safeParse(request.body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.');
    reply.code(422).send(shared.apiError('validation', 'Invalid ticket', field || undefined));
    return;
  }
  const binding = idem.computeBinding(ctx.tenantId, ctx.loginId, key, [
    'raise',
    parsed.data,
    idem.phoneActor(ctx),
  ]);
  const tx: RaiseTx = {
    tenantId: ctx.tenantId,
    key,
    auth: ctx,
    body: parsed.data as Record<string, unknown>,
  };
  const outcome = await runOutcome(pool, binding, (client) =>
    executeRaise(client, tx, binding, boss),
  );
  reply.code(outcome.status).send(outcome.body);
}
