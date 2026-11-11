import type { PoolClient } from 'pg';
import { persistEvents } from './ticket-sql.js';
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
  const result = await client.query(
    `SELECT id, list, code, label, label_gu, label_hi, active, sort FROM list_item
     WHERE tenant_id = $1 AND list = ANY($2::text[]) AND active = true
       AND ($3::text IS NULL OR list = $3)
     ORDER BY array_position($2::text[], list), sort, code`,
    [tenantId, TAG_CATEGORIES, category ?? null],
  );
  return result.rows.map(definition);
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
  const result = await client.query(
    `SELECT id, list, code, label, label_gu, label_hi, active, sort FROM list_item
     WHERE tenant_id = $1 AND id = $2 AND list = ANY($3::text[])`,
    [tenantId, itemId, TAG_CATEGORIES],
  );
  return result.rows[0] ? definition(result.rows[0]) : null;
}

export async function loadTicketTags(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
): Promise<TagList> {
  const result = await client.query(
    `SELECT t.item_id, t.applied_at, t.applied_by_login_id, t.applied_by_person_id,
       i.id, i.list, i.code, i.label, i.label_gu, i.label_hi, i.active, i.sort
     FROM ticket_tag t JOIN list_item i ON i.tenant_id = t.tenant_id AND i.id = t.item_id
     WHERE t.tenant_id = $1 AND t.ticket_id = $2
     ORDER BY array_position($3::text[], i.list), i.sort, i.code`,
    [tenantId, ticketId, TAG_CATEGORIES],
  );
  return {
    applied: result.rows.map((row) => ({
      tagId: row.item_id as string,
      appliedAt: (row.applied_at as Date).toISOString(),
      appliedBy: row.applied_by_person_id as string | null,
      appliedByLogin: row.applied_by_login_id as string | null,
    })),
    tags: result.rows.map(definition),
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
