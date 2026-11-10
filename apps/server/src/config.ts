import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { withTenant } from '@uptimo/db';

export interface ConfigPayload {
  features: Record<string, boolean>;
  language: string;
  timeZone: string;
  lists: Record<string, unknown[]>;
  segments: unknown[];
  groups: unknown[];
  machines: unknown[];
  people: unknown[];
  shifts: unknown[];
}

export function fingerprint(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12);
}

function listItem(row: Record<string, unknown>) {
  return {
    id: row.id,
    list: row.list,
    code: row.code,
    label: row.label,
    labelGu: row.label_gu,
    labelHi: row.label_hi,
    sort: row.sort,
    active: row.active,
    isVendor: row.is_vendor,
    pausesSla: row.pauses_sla,
    tag: row.tag,
  };
}

export async function loadConfig(pool: Pool, tenantId: string): Promise<ConfigPayload> {
  return withTenant(pool, tenantId, async (client) => {
    // Sequential queries: a single pg client cannot run concurrent queries
    // ("Calling client.query() when the client is already executing a query").
    const lists = await client.query(
      'SELECT id, list, code, label, label_gu, label_hi, sort, active, is_vendor, pauses_sla, tag FROM list_item ORDER BY list, sort, code',
    );
    const segments = await client.query(
      'SELECT id, code, name, sort, show_on_board, group_by FROM segment ORDER BY sort, code',
    );
    const groups = await client.query(
      'SELECT id, segment_id, code, name, sort, hidden FROM machine_group ORDER BY sort, code',
    );
    const machines = await client.query(
      'SELECT id, code, category, cell, segment_id, group_id, criticality FROM machine ORDER BY code',
    );
    const people = await client.query(
      'SELECT id, name, team, title, active, phone FROM person ORDER BY name',
    );
    const shifts = await client.query(
      'SELECT id, code, name, starts_at, ends_at, crosses_midnight FROM shift ORDER BY code',
    );
    const settings = await client.query('SELECT key, value FROM setting');
    const tenant = await client.query('SELECT * FROM tenant_info($1)', [tenantId]);
    const byList: Record<string, unknown[]> = {};
    for (const row of lists.rows) {
      (byList[row.list as string] ??= []).push(listItem(row as Record<string, unknown>));
    }
    const features = (settings.rows.find((row) => row.key === 'features')?.value ?? {
      general: true,
      pause: true,
    }) as Record<string, boolean>;
    return {
      features,
      language: tenant.rows[0].language,
      timeZone: tenant.rows[0].time_zone,
      lists: byList,
      segments: segments.rows,
      groups: groups.rows,
      machines: machines.rows,
      people: people.rows,
      shifts: shifts.rows,
    };
  });
}

export interface AppConfig {
  pool: Pool;
  logger?: boolean;
  rateLimitMax?: number;
}
