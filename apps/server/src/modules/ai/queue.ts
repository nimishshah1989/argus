import type { PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { AiSuggestPayload } from '@uptimo/shared';
import { jobDb, type TicketWrite } from '../../kernel/index.js';
import { ticketAlertFacts } from '../tickets/index.js';
import { DIAGNOSIS_PROMPT } from './diagnosis.js';
import { AI_SUGGEST_QUEUE } from './suggest.js';

const queueReady = new WeakSet<PgBoss>();

/**
 * `retryDelay` 95 s is above the 90 s claim lease, so pg-boss's own single retry (a crash or an
 * unexpected error) can re-claim a `running` row. Startup creates the queue; a sender that finds it
 * missing (an app built without `startAiJobs`) creates it once.
 */
export async function ensureAiQueue(boss: PgBoss): Promise<void> {
  if (queueReady.has(boss)) return;
  if (!(await boss.getQueue(AI_SUGGEST_QUEUE)))
    await boss.createQueue(AI_SUGGEST_QUEUE, {
      policy: 'standard',
      retryLimit: 1,
      retryDelay: 95,
      expireInSeconds: 90,
    });
  queueReady.add(boss);
}

/**
 * Runs inside a ticket write's transaction (a ticket listener), so the job exists only if the ticket does. Only a
 * breakdown (`stopped`) that is raised is diagnosed: not an upgrade later, not a past ticket entered after the fact.
 * The job's own gates (feature, residency, consent, cap) decide whether a call is made; this only queues it.
 */
export async function queueDiagnosisOnRaise(client: PoolClient, write: TicketWrite): Promise<void> {
  if (write.command !== 'raise' || !write.boss) return;
  const facts = await ticketAlertFacts(client, write.tenantId, write.ticketId);
  if (facts?.kind !== 'stopped') return;
  await ensureAiQueue(write.boss);
  const payload: AiSuggestPayload = {
    v: 1,
    tenantId: write.tenantId,
    feature: 'diagnosis',
    subjectType: 'ticket',
    subjectId: write.ticketId,
    promptVersion: DIAGNOSIS_PROMPT.version,
  };
  await write.boss.send(AI_SUGGEST_QUEUE, payload, { db: jobDb(client) });
}
