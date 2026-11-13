import type { PoolClient, QueryResult } from 'pg';

type Db = Pick<PoolClient, 'query'>;

const JOBS_SQL = `WITH touched AS (
    SELECT ticket_id FROM work_segment
     WHERE tenant_id = $1 AND person_id = $2 AND started_at < $4
       AND COALESCE(ended_at, $4) > $3
    UNION
    SELECT ticket_id FROM ticket_event
     WHERE tenant_id = $1 AND acting_person_id = $2 AND at >= $3 AND at < $4
  ), minutes AS (
    SELECT ticket_id,
           SUM(EXTRACT(EPOCH FROM (LEAST(COALESCE(ended_at, $4), $4) - GREATEST(started_at, $3))) / 60)::int
             AS mins
      FROM work_segment
     WHERE tenant_id = $1 AND person_id = $2 AND started_at < $4
       AND COALESCE(ended_at, $4) > $3
     GROUP BY ticket_id
  )
  SELECT t.id, t.ref, t.kind, t.status, t.problem, t.machine_snapshot, t.machine_id,
         COALESCE(minutes.mins, 0) AS minutes
    FROM touched
    JOIN ticket t ON t.id = touched.ticket_id AND t.tenant_id = $1
    LEFT JOIN minutes ON minutes.ticket_id = t.id
   ORDER BY t.reported_at, t.ref`;

export async function dayJobRows(
  tx: Db,
  input: { tenantId: string; personId: string; start: Date; end: Date },
): Promise<QueryResult['rows']> {
  const { tenantId, personId, start, end } = input;
  return (await tx.query(JOBS_SQL, [tenantId, personId, start, end])).rows;
}

const PENDING_SQL = `SELECT t.id, t.ref, t.kind, t.status, t.problem, t.reported_at, t.machine_snapshot, t.machine_id
    FROM ticket t
   WHERE t.tenant_id = $1 AND t.status IN ('open', 'working', 'waiting') AND t.reported_at < $2
   ORDER BY t.reported_at, t.ref`;

export async function pendingRows(
  tx: Db,
  tenantId: string,
  end: Date,
): Promise<QueryResult['rows']> {
  return (await tx.query(PENDING_SQL, [tenantId, end])).rows;
}

const TICKET_SQL = `SELECT t.id, t.ref, t.kind, t.status, t.problem, t.reported_at, t.closed_at,
    t.machine_snapshot, t.response_min, t.active_min, t.wait_min, t.vendor_min,
    t.handover_wait_min, t.down_acc_min, t.downtime_min, t.follow_min, t.repair_min, t.machine_id
  FROM ticket t
  WHERE t.id = $1 AND t.tenant_id = $2`;

export async function pdfTicketRow(
  tx: Db,
  tenantId: string,
  ticketId: string,
): Promise<QueryResult['rows']> {
  return (await tx.query(TICKET_SQL, [ticketId, tenantId])).rows;
}

export async function setReportPdf(
  tx: Db,
  input: {
    fileId: string;
    payload: Record<string, string | number | null>;
    reportId: string;
    tenantId: string;
  },
): Promise<void> {
  await tx.query(
    'UPDATE breakdown_report SET pdf_file_id = $1, qr_payload = $2 WHERE id = $3 AND tenant_id = $4',
    [input.fileId, input.payload, input.reportId, input.tenantId],
  );
}

export interface HistoryRow {
  id: string;
  machineId: string;
  reportedAt: Date;
  problem: string;
  closeNote: string | null;
  action: string | null; // corrective_action of the newest report
  rootCause: string | null;
  spare: string | null;
  code: string | null;
  category: string | null;
}

const MACHINE_HISTORY_SQL = `SELECT t.id, t.machine_id AS "machineId", t.reported_at AS "reportedAt", t.problem,
       t.close_note AS "closeNote", r.corrective_action AS action, r.root_cause AS "rootCause",
       r.spare_used AS spare, r.maint_code AS code, r.breakdown_category AS category
  FROM ticket t
  LEFT JOIN LATERAL (
    SELECT corrective_action, root_cause, spare_used, maint_code, breakdown_category
      FROM breakdown_report br
     WHERE br.tenant_id = t.tenant_id AND br.ticket_id = t.id
     ORDER BY br.submitted_at DESC LIMIT 1) r ON true
 WHERE t.tenant_id = $1 AND t.machine_id = ANY($2::uuid[])
   AND t.status = 'closed' AND t.reported_at < $3
 ORDER BY t.reported_at DESC, t.ref DESC
 LIMIT $4`;

/** Closed past tickets of the given machines, newest first. Names (observed_by, handover_name) are never read. */
export async function machineHistory(
  tx: Db,
  tenantId: string,
  query: { machineIds: readonly string[]; before: Date; limit: number },
): Promise<HistoryRow[]> {
  if (query.machineIds.length === 0) return [];
  return (
    await tx.query(MACHINE_HISTORY_SQL, [tenantId, query.machineIds, query.before, query.limit])
  ).rows;
}

const SEEN_ELSEWHERE_SQL = `SELECT DISTINCT n.note FROM (
  SELECT lower(regexp_replace(btrim(COALESCE(NULLIF(btrim(r.corrective_action), ''), t.close_note)), '\\s+', ' ', 'g')) AS note
    FROM ticket t
    LEFT JOIN LATERAL (
      SELECT corrective_action FROM breakdown_report br
       WHERE br.tenant_id = t.tenant_id AND br.ticket_id = t.id
       ORDER BY br.submitted_at DESC LIMIT 1) r ON true
   WHERE t.tenant_id = $1 AND t.status = 'closed' AND t.machine_id IS NOT NULL
     AND t.machine_id <> ALL($2::uuid[])
) n
 WHERE n.note = ANY($3::text[])`;

/** Which of the (normalised) notes are the closing note of a closed ticket on a machine outside the family. */
export async function notesSeenElsewhere(
  tx: Db,
  tenantId: string,
  query: { notes: readonly string[]; outsideMachineIds: readonly string[] },
): Promise<Set<string>> {
  if (query.notes.length === 0) return new Set();
  const rows = (
    await tx.query(SEEN_ELSEWHERE_SQL, [tenantId, query.outsideMachineIds, query.notes])
  ).rows;
  return new Set(rows.map((r: { note: string }) => r.note));
}
