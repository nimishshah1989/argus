import type { PgBoss } from 'pg-boss';
import type { AiSuggestPayload } from '@uptimo/shared';
import { jobDb, type TicketListener } from '../../kernel/index.js';
import { ticketAlertFacts } from '../tickets/index.js';
import type { AiConfig } from './config.js';
import { DIAGNOSIS_PROMPT } from './diagnosis.js';
import { AI_SUGGEST_QUEUE, gateProduction } from './suggest.js';

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
 * A ticket listener: runs inside a ticket write's transaction, so the job exists only if the ticket does. Only a
 * breakdown (`stopped`) that is raised is diagnosed: not an upgrade later, not a past ticket entered after the fact.
 * In production a job nobody could run is not queued: no key, no residency record, or the plant's consent or cap
 * not in place. Staging has no gate (build phase). The job re-checks every gate when it runs.
 */
export function diagnosisQueuer(ai: AiConfig): TicketListener {
  return async (client, write) => {
    if (write.command !== 'raise' || !write.boss) return;
    if (ai.production && (ai.apiKey === null || ai.residencyRecord === null)) return;
    if (await gateProduction(client, write.tenantId, ai)) return;
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
  };
}
