import type { PoolClient, QueryResult } from 'pg';

type Db = Pick<PoolClient, 'query'>;
type Rows = QueryResult['rows'];
type Row = Record<string, unknown>;

export async function refCounterRows(tx: Db, tenantId: string, prefix: string): Promise<Rows> {
  return (
    await tx.query('SELECT next_value FROM ref_counter WHERE tenant_id = $1 AND prefix = $2', [
      tenantId,
      prefix,
    ])
  ).rows;
}

export async function ticketRefsLike(tx: Db, tenantId: string, pattern: string): Promise<Rows> {
  return (
    await tx.query('SELECT ref FROM ticket WHERE tenant_id = $1 AND ref LIKE $2', [
      tenantId,
      pattern,
    ])
  ).rows;
}

export async function raiseRefCounter(
  tx: Db,
  input: { tenantId: string; prefix: string; next: number },
): Promise<void> {
  await tx.query(
    `INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, prefix) DO UPDATE SET next_value = GREATEST(ref_counter.next_value, $3)`,
    [input.tenantId, input.prefix, input.next],
  );
}

export async function ticketParents(tx: Db, tenantId: string): Promise<Rows> {
  return (
    await tx.query('SELECT id, ref, parent_id FROM ticket WHERE tenant_id = $1 ORDER BY ref', [
      tenantId,
    ])
  ).rows;
}

export async function setParent(
  tx: Db,
  input: { tenantId: string; childId: string; parentId: string },
): Promise<void> {
  await tx.query('UPDATE ticket SET parent_id = $1 WHERE id = $2 AND tenant_id = $3', [
    input.parentId,
    input.childId,
    input.tenantId,
  ]);
}

export async function refsByIds(
  tx: Db,
  tenantId: string,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const result = await tx.query(
    'SELECT id, ref FROM ticket WHERE tenant_id = $1 AND id = ANY($2::uuid[])',
    [tenantId, ids],
  );
  return new Map(result.rows.map((row) => [row.id as string, row.ref as string]));
}

export async function insertImportedTicket(
  tx: Db,
  columns: readonly string[],
  values: unknown[],
): Promise<string> {
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(',');
  const result = await tx.query(
    `INSERT INTO ticket (${columns.join(',')}) VALUES (${placeholders}) RETURNING id`,
    values,
  );
  return result.rows[0].id as string;
}

export async function insertImportedEvent(tx: Db, values: unknown[]): Promise<void> {
  await tx.query(
    `INSERT INTO ticket_event (
         tenant_id, ticket_id, seq, type, idempotency_key, at, login_id, acting_person_id, text, payload
       ) VALUES ($1,$2,$3,$4,NULL,$5,NULL,$6,$7,$8)`,
    values,
  );
}

export async function insertImportedCrew(tx: Db, values: unknown[]): Promise<void> {
  await tx.query(
    `INSERT INTO crew_member (
         tenant_id, ticket_id, person_id, role, joined_at, left_at, left_reason
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    values,
  );
}

export async function insertImportedSegment(tx: Db, values: unknown[]): Promise<void> {
  await tx.query(
    `INSERT INTO work_segment (
         tenant_id, ticket_id, person_id, role, started_at, ended_at, end_reason
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    values,
  );
}

export async function insertImportedReport(tx: Db, values: unknown[]): Promise<string> {
  const result = await tx.query(
    `INSERT INTO breakdown_report (
       tenant_id, ticket_id, machine_id, date, shift_code, problem, observed_by,
       corrective_action, downtime_min, response_min, repair_min, breakdown_category,
       maint_code, spare_used, root_cause, handover_name, submitted_by_person_id, submitted_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING id`,
    values,
  );
  return result.rows[0].id as string;
}

export async function insertReportPerson(tx: Db, values: unknown[]): Promise<void> {
  await tx.query(
    `INSERT INTO breakdown_report_person (tenant_id, report_id, person_id, role)
       VALUES ($1, $2, $3, $4)`,
    values,
  );
}

export async function importedTicketRows(
  tx: Db,
  input: { tenantId: string; ticketIds: string[]; columns: string; lock: boolean },
): Promise<Rows> {
  const result = await tx.query(
    `SELECT ${input.columns} FROM ticket WHERE tenant_id = $1 AND id = ANY($2::uuid[])
     ORDER BY id${input.lock ? ' FOR UPDATE' : ''}`,
    [input.tenantId, input.ticketIds],
  );
  return result.rows;
}

export async function importedChildren(
  tx: Db,
  tenantId: string,
  ticketIds: string[],
): Promise<{ rows: Row[]; reports: Row[]; people: Row[] }> {
  const rows: Row[] = [];
  for (const sql of [
    `SELECT ticket_id, seq, type, idempotency_key, at, login_id, acting_person_id, text, payload
     FROM ticket_event WHERE tenant_id = $1 AND ticket_id = ANY($2::uuid[]) ORDER BY ticket_id, seq`,
    `SELECT ticket_id, id, person_id, role, joined_at, left_at, left_reason
     FROM crew_member WHERE tenant_id = $1 AND ticket_id = ANY($2::uuid[]) ORDER BY ticket_id, id`,
    `SELECT ticket_id, id, person_id, role, started_at, ended_at, end_reason
     FROM work_segment WHERE tenant_id = $1 AND ticket_id = ANY($2::uuid[]) ORDER BY ticket_id, id`,
  ]) {
    rows.push(...(await tx.query(sql, [tenantId, ticketIds])).rows);
  }
  const reports = (
    await tx.query(
      `SELECT ticket_id, id, machine_id, date::text AS date, shift_code, problem, observed_by,
        corrective_action, downtime_min, response_min, repair_min, breakdown_category, maint_code,
        spare_used, root_cause, handover_name, signature_file_id, pdf_file_id, qr_payload,
        submitted_by_person_id, submitted_at, approved_at
       FROM breakdown_report WHERE tenant_id = $1 AND ticket_id = ANY($2::uuid[])
       ORDER BY ticket_id, id`,
      [tenantId, ticketIds],
    )
  ).rows;
  const reportIds = reports.map((row) => row.id as string);
  const people = reportIds.length
    ? (
        await tx.query(
          `SELECT report_id, person_id, role FROM breakdown_report_person
           WHERE tenant_id = $1 AND report_id = ANY($2::uuid[])
           ORDER BY report_id, person_id, role`,
          [tenantId, reportIds],
        )
      ).rows
    : [];
  return { rows, reports, people };
}

/** The ref of a ticket outside `ids` whose parent is inside it, if any. */
export async function outsideChildRef(
  tx: Db,
  tenantId: string,
  ids: string[],
): Promise<string | undefined> {
  const child = await tx.query(
    `SELECT ref FROM ticket WHERE tenant_id = $1 AND parent_id = ANY($2::uuid[])
       AND id <> ALL($2::uuid[]) LIMIT 1`,
    [tenantId, ids],
  );
  return child.rows[0]?.ref;
}

/** The id of a report on `ids` that already carries a signature or PDF file, if any. */
export async function reportWithFileId(
  tx: Db,
  tenantId: string,
  ids: string[],
): Promise<string | undefined> {
  const report = await tx.query(
    `SELECT id FROM breakdown_report WHERE tenant_id = $1 AND ticket_id = ANY($2::uuid[])
       AND (signature_file_id IS NOT NULL OR pdf_file_id IS NOT NULL) LIMIT 1`,
    [tenantId, ids],
  );
  return report.rows[0]?.id;
}

/** Removes the reports, then the tickets; returns how many tickets went. */
export async function deleteImportedTickets(
  tx: Db,
  tenantId: string,
  ids: string[],
): Promise<number | null> {
  await tx.query(
    'DELETE FROM breakdown_report WHERE tenant_id = $1 AND ticket_id = ANY($2::uuid[])',
    [tenantId, ids],
  );
  const deleted = await tx.query(
    'DELETE FROM ticket WHERE tenant_id = $1 AND id = ANY($2::uuid[]) RETURNING id',
    [tenantId, ids],
  );
  return deleted.rowCount;
}
