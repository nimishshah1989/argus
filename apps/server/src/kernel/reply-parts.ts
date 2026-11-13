import type { PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';

export interface TicketWrite {
  tenantId: string;
  ticketId: string;
  now: Date;
  boss?: PgBoss;
}

export interface TicketPart {
  /** The reply key this part owns, e.g. 'sla'. */
  readonly name: string;
  /** One batch read for every ticket in the reply (never per ticket). */
  load(
    client: PoolClient,
    tenantId: string,
    ticketIds: string[],
    now: Date,
  ): Promise<Map<string, unknown>>;
  /** Inside a ticket write's transaction, after the row is stored: react, then return the fields for that reply. */
  afterWrite(client: PoolClient, write: TicketWrite): Promise<Record<string, unknown>>;
}

export interface ConfigPart {
  readonly name: string;
  load(client: PoolClient, tenantId: string): Promise<unknown>;
}

// Module-global; contributing a name again replaces it (one test file may build several apps).
const ticketParts = new Map<string, TicketPart>();
const configPartList = new Map<string, ConfigPart>();

export function contributeTicketPart(part: TicketPart): void {
  ticketParts.set(part.name, part);
}

export function contributeConfigPart(part: ConfigPart): void {
  configPartList.set(part.name, part);
}

/** `project(row)` then each part's value under its name (`?? null`), parts in contribution order. */
export async function withTicketParts(
  client: PoolClient,
  tenantId: string,
  rows: Record<string, unknown>[],
  project: (row: Record<string, unknown>) => Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const now = new Date();
  const ids = rows.map((row) => row.id as string);
  const loaded: Array<[string, Map<string, unknown>]> = [];
  for (const part of ticketParts.values()) {
    loaded.push([part.name, await part.load(client, tenantId, ids, now)]);
  }
  return rows.map((row) => {
    const out = project(row);
    for (const [name, values] of loaded) out[name] = values.get(row.id as string) ?? null;
    return out;
  });
}

/** Every part's `afterWrite`, merged in contribution order. */
export async function ticketPartsAfterWrite(
  client: PoolClient,
  write: TicketWrite,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const part of ticketParts.values()) Object.assign(out, await part.afterWrite(client, write));
  return out;
}

/** `{ [part.name]: await part.load(client, tenantId) }` for every config part, in contribution order. */
export async function configParts(
  client: PoolClient,
  tenantId: string,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const part of configPartList.values()) out[part.name] = await part.load(client, tenantId);
  return out;
}
