import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

/**
 * The refs of the tickets still in progress that rely on this person: its lead, on its crew, in an open work
 * stretch, assigned to them, or handed over to them. Switching them off would strand these.
 */
export async function activeTicketRefsOfPerson(tx: Db, personId: string): Promise<string[]> {
  const rows = (
    await tx.query(
      `SELECT t.ref FROM ticket t
       WHERE t.status IN ('open', 'working', 'waiting')
         AND (t.lead_person_id = $1 OR t.assigned_to_person_id = $1 OR t.transfer_to_person_id = $1
              OR EXISTS (SELECT 1 FROM crew_member c
                         WHERE c.ticket_id = t.id AND c.person_id = $1 AND c.left_at IS NULL)
              OR EXISTS (SELECT 1 FROM work_segment w
                         WHERE w.ticket_id = t.id AND w.person_id = $1 AND w.ended_at IS NULL))
       ORDER BY t.ref`,
      [personId],
    )
  ).rows;
  return rows.map((r) => r.ref as string);
}
