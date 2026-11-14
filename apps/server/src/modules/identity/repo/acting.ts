import type { Pool } from 'pg';
import { withTenant } from '@uptimo/db';

const NOT_VENDOR = ['maintenance', 'production'] as const;
const TEAMS_BY_ROLE: Record<string, readonly string[]> = {
  operator: ['production'],
  technician: ['maintenance'],
  supervisor: NOT_VENDOR,
  head: NOT_VENDOR,
  plant_head: NOT_VENDOR,
  // a kiosk board phone is no less open than before; an admin phone chooses nobody (the API refuses a shared admin)
  board: NOT_VENDOR,
};

/**
 * The teams whose people a shared phone of this role may be used by (DOMAIN §3: "the plant's active people for that
 * team"). A floor phone is used by production, a maintenance phone by maintenance, a supervisor's, head's or board phone by
 * either; a vendor is never chosen on a shared phone, and a role with no entry (admin) chooses nobody.
 * The one rule behind the list a phone is shown and the check on the choice.
 */
export const actingTeams = (role: string): readonly string[] => TEAMS_BY_ROLE[role] ?? [];

export interface ActingChoice {
  id: string;
  name: string;
  team: string;
}

/** The people a shared phone of this role may choose: active, of its teams. Names and teams only. */
export async function listActingChoices(
  pool: Pool,
  tenantId: string,
  role: string,
): Promise<ActingChoice[]> {
  const result = await withTenant(pool, tenantId, (client) =>
    client.query(
      'SELECT id, name, team FROM person WHERE active AND team = ANY($1::text[]) ORDER BY name',
      [actingTeams(role)],
    ),
  );
  return result.rows;
}
