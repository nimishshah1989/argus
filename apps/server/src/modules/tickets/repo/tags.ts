import type { PoolClient } from 'pg';
import { listItemOf, listItemsByIds, listItemsOf } from '../../plant/index.js';
import { persistEvents } from './ticket.js';
import { TAG_CATEGORIES, type TagCategory, type TagDefinition, type TagList } from '@uptimo/shared';

function definition(row: Record<string, unknown>): TagDefinition {
  return {
    id: row.id as string,
    code: row.code as string,
    label: row.label as string,
    ...(row.label_gu ? { labelGu: row.label_gu as string } : {}),
    ...(row.label_hi ? { labelHi: row.label_hi as string } : {}),
    category: row.list as TagCategory,
    active: row.active as boolean,
    sortOrder: row.sort as number,
  };
}

/** Active controlled values owned by the current tenant. */
export async function listCatalogue(
  client: PoolClient,
  tenantId: string,
  category?: TagCategory,
): Promise<TagDefinition[]> {
  const rows = await listItemsOf(client, tenantId, TAG_CATEGORIES, category ?? null);
  return rows.map(definition);
}

export async function ticketExists(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
): Promise<boolean> {
  const result = await client.query('SELECT id FROM ticket WHERE tenant_id = $1 AND id = $2', [
    tenantId,
    ticketId,
  ]);
  return result.rowCount === 1;
}

export async function findDefinition(
  client: PoolClient,
  tenantId: string,
  itemId: string,
): Promise<TagDefinition | null> {
  const row = await listItemOf(client, tenantId, itemId, TAG_CATEGORIES);
  return row ? definition(row) : null;
}

export async function loadTicketTags(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
): Promise<TagList> {
  const assignments = (
    await client.query(
      `SELECT item_id, applied_at, applied_by_login_id, applied_by_person_id
     FROM ticket_tag WHERE tenant_id = $1 AND ticket_id = $2`,
      [tenantId, ticketId],
    )
  ).rows;
  const items =
    assignments.length === 0
      ? []
      : await listItemsByIds(
          client,
          tenantId,
          assignments.map((row) => row.item_id as string),
          TAG_CATEGORIES,
        );
  const byItem = new Map(assignments.map((row) => [row.item_id as string, row]));
  const paired = items.map((item) => ({ item, row: byItem.get(item.id as string) }));
  return {
    applied: paired.flatMap(({ row }) =>
      row
        ? [
            {
              tagId: row.item_id as string,
              appliedAt: (row.applied_at as Date).toISOString(),
              appliedBy: row.applied_by_person_id as string | null,
              appliedByLogin: row.applied_by_login_id as string | null,
            },
          ]
        : [],
    ),
    tags: items.map(definition),
  };
}

interface AssignmentInput {
  tenantId: string;
  ticketId: string;
  itemId: string;
  loginId: string;
  personId: string | null;
}

export async function addAssignment(client: PoolClient, input: AssignmentInput): Promise<boolean> {
  const { tenantId, ticketId, itemId, loginId, personId } = input;
  const result = await client.query(
    `INSERT INTO ticket_tag
       (tenant_id, ticket_id, item_id, applied_by_login_id, applied_by_person_id)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id`,
    [tenantId, ticketId, itemId, loginId, personId],
  );
  return result.rowCount === 1;
}

export async function removeAssignment(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
  itemId: string,
): Promise<boolean> {
  const result = await client.query(
    'DELETE FROM ticket_tag WHERE tenant_id = $1 AND ticket_id = $2 AND item_id = $3 RETURNING id',
    [tenantId, ticketId, itemId],
  );
  return result.rowCount === 1;
}

interface TagEventInput {
  tenantId: string;
  ticketId: string;
  sequence: number;
  key: string;
  loginId: string;
  personId: string | null;
  type: 'tag_add' | 'tag_remove';
  definition: TagDefinition;
}

export async function appendTagEvent(client: PoolClient, input: TagEventInput): Promise<void> {
  const action = input.type === 'tag_add' ? 'added' : 'removed';
  await persistEvents(client, input.tenantId, input.ticketId, {
    events: [
      { type: input.type, at: new Date(), reason: `Tag ${action}: ${input.definition.label}` },
    ],
    startSeq: input.sequence,
    idempotencyKey: input.key,
    loginId: input.loginId,
    actingPersonId: input.personId,
    payloadFor: () => ({
      tagId: input.definition.id,
      code: input.definition.code,
      category: input.definition.category,
    }),
  });
  await client.query(
    'UPDATE ticket SET last_event_seq = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2',
    [input.tenantId, input.ticketId, input.sequence],
  );
}
