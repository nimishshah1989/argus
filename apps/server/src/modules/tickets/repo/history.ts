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
