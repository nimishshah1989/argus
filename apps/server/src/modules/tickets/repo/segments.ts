import type { PoolClient } from 'pg';
import type { WorkSegment } from '@uptimo/domain';
import type { CommandAction } from '../mapper.js';

export type SegmentEndReason = 'pause' | 'transfer' | 'leave' | 'close' | 'cancel';

export interface SegmentWrite {
  segments: WorkSegment[];
  endReason: SegmentEndReason | null;
}

const END_REASONS: Partial<Record<CommandAction, SegmentEndReason>> = {
  pause: 'pause',
  transfer: 'transfer',
  leave: 'leave',
  close: 'close',
  cancel: 'cancel',
};

/** Why a command closes an open stretch; null for the commands that close none. */
export function endReasonFor(action: CommandAction): SegmentEndReason | null {
  return END_REASONS[action] ?? null;
}

/** Ordered by (started_at, id) so persistSegments can line its rows up with the domain list. */
export async function loadSegments(client: PoolClient, ticketId: string): Promise<WorkSegment[]> {
  const result = await client.query(
    `SELECT person_id, role, started_at, ended_at FROM work_segment
       WHERE ticket_id = $1 ORDER BY started_at, id`,
    [ticketId],
  );
  return result.rows.map((row) => ({
    personId: row.person_id as string,
    role: row.role as WorkSegment['role'],
    startedAt: new Date(row.started_at as string | number | Date),
    ...(row.ended_at ? { endedAt: new Date(row.ended_at as string | number | Date) } : {}),
  }));
}

const LOST = 'work_segment rows would be lost';

/** Inserts new stretches and stamps ended_at/end_reason by id. Never deletes. */
export async function persistSegments(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
  input: SegmentWrite,
): Promise<void> {
  const { segments, endReason } = input;
  const { rows } = await client.query(
    `SELECT id, person_id, role, started_at, ended_at FROM work_segment
       WHERE tenant_id = $1 AND ticket_id = $2 ORDER BY started_at, id`,
    [tenantId, ticketId],
  );
  if (rows.length > segments.length) throw new Error(LOST);
  for (const [i, row] of rows.entries()) {
    const s = segments[i] as WorkSegment;
    const same =
      row.person_id === s.personId &&
      row.role === s.role &&
      new Date(row.started_at as string | number | Date).getTime() === s.startedAt.getTime();
    if (!same) throw new Error(LOST);
    if (row.ended_at !== null || !s.endedAt) continue;
    if (endReason === null) throw new Error('work_segment closed without an end reason');
    await client.query(
      'UPDATE work_segment SET ended_at = $1, end_reason = $2, updated_at = now() WHERE id = $3',
      [s.endedAt, endReason, row.id],
    );
  }
  for (const s of segments.slice(rows.length))
    await client.query(
      `INSERT INTO work_segment (tenant_id, ticket_id, person_id, role, started_at, ended_at, end_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tenantId,
        ticketId,
        s.personId,
        s.role,
        s.startedAt,
        s.endedAt ?? null,
        s.endedAt ? endReason : null,
      ],
    );
}
