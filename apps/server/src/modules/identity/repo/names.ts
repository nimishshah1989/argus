import type { PoolClient } from 'pg';
import { personCode } from '../repo.js';

type Db = Pick<PoolClient, 'query'>;

/**
 * A person code as the engine prints it (`P-` and the first eight characters of the id), or, first, a named person in
 * redacted free text (`textPlaceholder`).
 */
const CODE = /\[P-(\d{1,5}):(\d{1,5})\]|\bP-[0-9a-f]{8}\b/g;

const half = (hex: string): number => Number.parseInt(hex, 16);
const hex4 = (digits: string): string => Number(digits).toString(16).padStart(4, '0');

/**
 * How the engine's redactor writes a named person into free text (ADR 0059 addendum): the code's two 16-bit halves
 * in decimal, `[P-16193:11092]`. Digits only, so no word count, token index or part key of the engine reads it as a
 * word; short runs split by a colon, so no phone check takes it for a number; and the boundary can turn it back.
 */
export const textPlaceholder = (code: string): string =>
  `[P-${half(code.slice(2, 6))}:${half(code.slice(6, 10))}]`;

/**
 * The plant's person codes and the names they stand for (ADR 0059). An erased person is left out, so their code
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
 * Each name, short name and own username of a live person, lowercased, with that person's code (ADR 0059 addendum),
 * for the engine's redactor. A term two people share is left out (it cannot say who), as is an erased person: their
 * mention stays a plain placeholder. Phones are not here: a number stays `[PHONE]`.
 */
export async function redactionCodes(
  tx: Db,
  tenantId: string,
): Promise<ReadonlyMap<string, string>> {
  const rows: { id: string; term: string }[] = (
    await tx.query(
      `SELECT p.id, t.term FROM person p
         CROSS JOIN LATERAL (VALUES (p.name), (p.short_name)) AS t(term)
        WHERE p.tenant_id = $1 AND p.erasure_hash IS NULL AND lower(trim(p.name)) <> 'former staff'
       UNION
       SELECT p.id, l.username FROM login l JOIN person p ON p.id = l.person_id
        WHERE l.tenant_id = $1 AND NOT l.shared AND p.erasure_hash IS NULL
          AND lower(trim(p.name)) <> 'former staff'`,
      [tenantId],
    )
  ).rows;
  const owners = new Map<string, Set<string>>();
  for (const { id, term } of rows) {
    const key = term?.trim().toLowerCase();
    if (key) owners.set(key, (owners.get(key) ?? new Set()).add(personCode(id)));
  }
  return new Map(
    [...owners].flatMap(([key, codes]) => (codes.size === 1 ? [[key, [...codes][0]!]] : [])),
  );
}

/**
 * A reply with every person code in its strings swapped for the person's name (ADR 0059). The engine and what it
 * stores stay name-free; this runs on the way out. A named person in free text (`[P-<n>:<n>]`) becomes the bare name.
 * Object keys are left alone (they are ids, and two people may
 * share a name), as is anything that is not plain JSON. A code with no name (erased, unknown) stays as it is.
 */
export function nameCodes<T>(value: T, names: ReadonlyMap<string, string>): T {
  if (typeof value === 'string') {
    return value.replace(
      CODE,
      (found, high?: string, low?: string) =>
        names.get(high === undefined ? found : `P-${hex4(high)}${hex4(low!)}`) ?? found,
    ) as T;
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
