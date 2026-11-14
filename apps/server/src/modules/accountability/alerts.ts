import type { PoolClient } from 'pg';
import type { TicketWrite } from '../../kernel/index.js';
import { activePerson, peopleWithRole } from '../identity/index.js';
import { notify } from '../notifications/index.js';
import { ticketAlertFacts } from '../tickets/index.js';

/** Who hears about a new breakdown: the maintenance side (v3 parity row v3.alerts.01). */
export const BREAKDOWN_ROLES = ['technician', 'supervisor'] as const;
/** A raise and an upgrade of a support ticket to a breakdown both start one; a close ends one. */
const ALERTING: ReadonlySet<string> = new Set(['raise', 'upgrade-kind', 'close']);

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
  if (!(await activePerson(client, write.tenantId, reporter))) return;
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
 * themselves. Alerts go to people with a personal login of the right role who are still on; a shared phone with
 * nobody acting is not a person. A repeated alert for one ticket is the same message (same key). Runs inside the ticket write's transaction, so the message exists only if the write does.
 */
export async function alertOnTicketWrite(client: PoolClient, write: TicketWrite): Promise<void> {
  if (!ALERTING.has(write.command)) return;
  const facts = await ticketAlertFacts(client, write.tenantId, write.ticketId);
  if (!facts) return;
  if (write.command === 'close') await tellReporter(client, write, facts);
  else await tellMaintenance(client, write, facts);
}
