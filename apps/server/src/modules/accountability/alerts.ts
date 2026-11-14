import type { PoolClient } from 'pg';
import type { TicketWrite } from '../../kernel/index.js';
import { peopleWithRole } from '../identity/index.js';
import { notify } from '../notifications/index.js';
import { ticketAlertFacts } from '../tickets/index.js';

/** Who hears about a new breakdown: the maintenance side (v3 parity row v3.alerts.01). */
export const BREAKDOWN_ROLES = ['technician', 'supervisor'] as const;

type Facts = NonNullable<Awaited<ReturnType<typeof ticketAlertFacts>>>;

async function tellMaintenance(
  client: PoolClient,
  write: TicketWrite,
  facts: Facts,
): Promise<void> {
  if (facts.kind !== 'stopped') return;
  const to = (await peopleWithRole(client, write.tenantId, BREAKDOWN_ROLES)).filter(
    (person) => person !== facts.reportedByPersonId,
  );
  await notify(client, write.boss ?? null, {
    tenantId: write.tenantId,
    ticketId: write.ticketId,
    now: write.now,
    to,
    kind: 'breakdown.new',
    dedupeKey: `breakdown:${write.ticketId}`,
  });
}

async function tellReporter(client: PoolClient, write: TicketWrite, facts: Facts): Promise<void> {
  const reporter = facts.reportedByPersonId;
  if (facts.status !== 'closed' || !facts.closedAt || !reporter) return;
  if (reporter === facts.closedByPersonId) return;
  await notify(client, write.boss ?? null, {
    tenantId: write.tenantId,
    ticketId: write.ticketId,
    now: write.now,
    to: [reporter],
    kind: 'complaint.fixed',
    dedupeKey: `fixed:${write.ticketId}:${facts.closedAt.getTime()}`,
  });
}

/**
 * The two v3 pushes. A new breakdown goes to the active technicians and supervisors of the plant, except the
 * person who reported it; a closed ticket goes back to the person who reported it, unless they closed it
 * themselves. Runs inside the ticket write's transaction, so the message exists only if the write does.
 */
export async function alertOnTicketWrite(client: PoolClient, write: TicketWrite): Promise<void> {
  if (write.command !== 'raise' && write.command !== 'close') return;
  const facts = await ticketAlertFacts(client, write.tenantId, write.ticketId);
  if (!facts) return;
  if (write.command === 'raise') await tellMaintenance(client, write, facts);
  else await tellReporter(client, write, facts);
}
