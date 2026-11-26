import type { PoolClient } from 'pg';
import { personCode } from '../repo.js';

type Db = Pick<PoolClient, 'query'>;

/** A person code as the engine prints it: `P-` and the first eight characters of the id. */
const CODE = /\bP-[0-9a-f]{8}\b/g;

/**
 * The plant's person codes and the names they stand for (ADR 0058). An erased person is left out, so their code
 * stays a code: the name an erasure leaves ("Former staff") is never shown in its place.
 */
export async function personNames(tx: Db, tenantId: string): Promise<ReadonlyMap<string, string>> {
  const rows: { id: string; name: string }[] = (
    await tx.query(
      `SELECT id, name FROM person
        WHERE tenant_id = $1 AND erasure_hash IS NULL AND lower(trim(name)) <> 'former staff'`,
      [tenantId],
    )
  ).rows;
  return new Map(rows.map((row) => [personCode(row.id), row.name]));
}

/**
 * A reply with every person code in its strings swapped for the person's name (ADR 0058). The engine and what it
 * stores stay name-free; this runs on the way out. Object keys are left alone (they are ids, and two people may
 * share a name), as is anything that is not plain JSON. A code with no name (erased, unknown) stays as it is.
 */
export function nameCodes<T>(value: T, names: ReadonlyMap<string, string>): T {
  if (typeof value === 'string') {
    return value.replace(CODE, (code) => names.get(code) ?? code) as T;
  }
  if (Array.isArray(value)) return value.map((item: unknown) => nameCodes(item, names)) as T;
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, nameCodes(item, names)]),
    ) as T;
  }
  return value;
}
