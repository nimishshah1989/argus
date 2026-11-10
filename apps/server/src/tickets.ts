import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { apiError, raiseTicketSchema } from '@argus/shared';
import { nextRef } from '@argus/domain';
import { withTenant } from '@argus/db';
import { requireAuth } from './auth.js';
import type { AppConfig } from './config.js';

async function findMachine(client: import('pg').PoolClient, machineId: string) {
  return (await client.query('SELECT id FROM machine WHERE id = $1', [machineId])).rows[0];
}

async function findDuplicate(client: import('pg').PoolClient, machineId: string) {
  return (
    await client.query(
      "SELECT id, ref FROM ticket WHERE machine_id = $1 AND status NOT IN ('closed', 'cancelled') LIMIT 1",
      [machineId],
    )
  ).rows[0];
}

async function allocateRef(client: import('pg').PoolClient, tenantId: string): Promise<string> {
  const counter = (
    await client.query("SELECT next_value FROM ref_counter WHERE prefix = 'BD' FOR UPDATE")
  ).rows[0];
  const next = counter ? Number(counter.next_value) : 1;
  await client.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', $2) ON CONFLICT (tenant_id, prefix) DO UPDATE SET next_value = $2",
    [tenantId, next + 1],
  );
  return nextRef('BD', next);
}

async function insertTicket(
  client: import('pg').PoolClient,
  args: {
    tenantId: string;
    ref: string;
    kind: string;
    machineId: string;
    problem: string;
    reportedBy: string | null;
    loginId: string;
    startNow: boolean;
  },
) {
  const startedAt = args.startNow ? new Date().toISOString() : null;
  const ticket = (
    await client.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, reported_by_person_id, raised_login_id, raised_channel, self_started, started_at, last_event_seq)
       VALUES ($1, $2, $3, 'open', $4, $5, now(), $6, $7, 'floor', $8, $9, 1) RETURNING id, ref, kind, status, machine_id, problem, reported_at`,
      [
        args.tenantId,
        args.ref,
        args.kind,
        args.machineId,
        args.problem,
        args.reportedBy,
        args.loginId,
        args.startNow,
        startedAt,
      ],
    )
  ).rows[0];
  await client.query(
    "INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, login_id, acting_person_id, text) VALUES ($1, $2, 1, 'down', $3, $4, $5)",
    [args.tenantId, ticket.id, args.loginId, args.reportedBy, args.problem],
  );
  return ticket;
}

async function raise(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const parsed = raiseTicketSchema.safeParse(request.body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.');
    reply.code(422).send(apiError('validation', 'Invalid ticket', field));
    return;
  }
  const { machineId, problem, kind, reportedByPersonId, startNow } = parsed.data;
  const created = await withTenant(pool, ctx.tenantId, async (client) => {
    if (!(await findMachine(client, machineId))) return { notFound: true };
    const duplicate = await findDuplicate(client, machineId);
    if (duplicate) return { conflict: duplicate };
    const ref = await allocateRef(client, ctx.tenantId);
    const ticket = await insertTicket(client, {
      tenantId: ctx.tenantId,
      ref,
      kind,
      machineId,
      problem,
      reportedBy: reportedByPersonId ?? ctx.personId,
      loginId: ctx.loginId,
      startNow: startNow ?? false,
    });
    return { ticket };
  });
  if (created.notFound) {
    reply.code(404).send(apiError('not_found', 'Unknown machine'));
    return;
  }
  if (created.conflict) {
    reply.code(409).send(apiError('conflict', 'Already reported', 'machineId'));
    return;
  }
  reply.code(201).send(created.ticket);
}

async function state(pool: Pool, request: FastifyRequest, reply: FastifyReply) {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const rows = await withTenant(pool, ctx.tenantId, (client) =>
    client.query(
      "SELECT id, ref, kind, status, machine_id, problem, reported_at, started_at, machine_snapshot FROM ticket WHERE status IN ('open', 'working', 'waiting') ORDER BY reported_at DESC",
    ),
  );
  reply.send({ open: rows.rows, now: new Date().toISOString() });
}

export function registerTickets(app: FastifyInstance, config: AppConfig): void {
  const { pool } = config;
  app.post('/api/v1/tickets', (request, reply) => raise(pool, request, reply));
  app.get('/api/v1/state', (request, reply) => state(pool, request, reply));
}
