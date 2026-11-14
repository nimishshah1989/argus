import { createHmac } from 'node:crypto';
import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

/** The server's secret for the erasure hashes is missing or too short. Nothing is erased or checked without it. */
export class ErasureKeyMissing extends Error {
  constructor() {
    super(
      'ERASURE_HASH_KEY is not set (at least 32 characters): erasing and creating people is refused',
    );
    this.name = 'ErasureKeyMissing';
  }
}

/** A person with this name and number was erased and may not be created again. The message holds no personal data. */
export class ErasedPersonError extends Error {
  constructor(message = 'This person was erased and cannot be created again') {
    super(message);
    this.name = 'ErasedPersonError';
  }
}

export interface Identity {
  name: string;
  phone?: string | null;
  /** An edit: this person's own row is not an erased person to compare with. */
  exceptId?: string;
}

export const normaliseName = (name: string): string =>
  name.normalize('NFKC').replace(/\0/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const normalisePhone = (phone: string | null | undefined): string =>
  (phone ?? '').replace(/\D/g, '');

function keyOrNull(): string | null {
  const key = process.env.ERASURE_HASH_KEY;
  return key !== undefined && key.length >= 32 ? key : null;
}

/**
 * One HMAC-SHA256 under the server key. The label keeps the two hashes apart (they can never be equal) and the plant
 * is part of the input, so the same name erased in two plants leaves two different values.
 */
function hmac(label: 'full' | 'name', tenantId: string, ...parts: string[]): string {
  const key = keyOrNull();
  if (!key) throw new ErasureKeyMissing();
  return createHmac('sha256', key)
    .update([label, tenantId, ...parts].join('\0'))
    .digest('hex');
}

/** Name and number together: a full match is certain enough to refuse. Throws without the key: no default. */
export const erasureHash = (
  tenantId: string,
  name: string,
  phone: string | null | undefined,
): string => hmac('full', tenantId, normaliseName(name), normalisePhone(phone));

/** The name alone: what an import can know. A match is only ever a hint for a person to look at. */
export const erasureNameHash = (tenantId: string, name: string): string =>
  hmac('name', tenantId, normaliseName(name));

/** Without the key a plant that has erased people cannot be checked, so it is refused; one with none has nothing to match. */
async function keyGuard(tx: Db, tenantId: string): Promise<boolean> {
  if (keyOrNull()) return true;
  const any = await tx.query(
    'SELECT 1 FROM person WHERE tenant_id = $1 AND erasure_hash IS NOT NULL LIMIT 1',
    [tenantId],
  );
  if (any.rowCount) throw new ErasureKeyMissing();
  return false;
}

/** The normalised names, among these, whose name-only hash matches an erased person of the plant. */
export async function erasedNamesAmong(
  tx: Db,
  tenantId: string,
  names: readonly string[],
): Promise<Set<string>> {
  const distinct = [...new Set(names.map(normaliseName))];
  if (distinct.length === 0 || !(await keyGuard(tx, tenantId))) return new Set();
  const byHash = new Map(distinct.map((n) => [erasureNameHash(tenantId, n), n]));
  const hit = await tx.query(
    'SELECT erasure_name_hash FROM person WHERE tenant_id = $1 AND erasure_name_hash = ANY($2::text[])',
    [tenantId, [...byHash.keys()]],
  );
  return new Set(hit.rows.map((r) => byHash.get(r.erasure_name_hash as string) as string));
}

/**
 * Refuses (ErasedPersonError) a person whose name and number both match an erased person. Anyone else, with no
 * number or another one, is let through; the answer says whether the name alone matches, so the caller can flag it.
 */
export async function refuseErased(tx: Db, tenantId: string, who: Identity): Promise<boolean> {
  if (!(await keyGuard(tx, tenantId))) return false;
  if (normalisePhone(who.phone)) {
    const full = await tx.query(
      `SELECT 1 FROM person WHERE tenant_id = $1 AND erasure_hash = $2
         AND ($3::uuid IS NULL OR id <> $3) LIMIT 1`,
      [tenantId, erasureHash(tenantId, who.name, who.phone), who.exceptId ?? null],
    );
    if (full.rowCount) throw new ErasedPersonError();
  }
  return (await erasedNamesAmong(tx, tenantId, [who.name])).size > 0;
}

/**
 * An edit of a person's name or number. An erased person's row keeps neither (it is "Former staff" for good); anyone
 * else may not be edited into a name and number that match an erased person, on the values they would have after it.
 */
export async function refuseErasedEdit(
  tx: Db,
  tenantId: string,
  before: { id: string; name: string; phone: string | null },
  patch: { name?: string; phone?: string | null },
): Promise<void> {
  if (patch.name === undefined && patch.phone === undefined) return;
  const erased = await tx.query(
    'SELECT 1 FROM person WHERE tenant_id = $1 AND id = $2 AND erasure_hash IS NOT NULL',
    [tenantId, before.id],
  );
  if (erased.rowCount) {
    // A form that saves another field sends the row back as it is: only a real change is refused.
    const nameChanged = patch.name !== undefined && patch.name !== before.name;
    const phoneChanged = patch.phone !== undefined && (patch.phone || null) !== before.phone;
    if (nameChanged || phoneChanged) {
      throw new ErasedPersonError("An erased person's name and phone cannot be changed");
    }
    return;
  }
  await refuseErased(tx, tenantId, {
    name: patch.name ?? before.name,
    phone: patch.phone === undefined ? before.phone : patch.phone,
    exceptId: before.id,
  });
}

/** Erases one person: both hashes are made from their current name and number first, then the database does the rest. */
export async function erasePerson(
  tx: Db,
  args: { tenantId: string; personId: string; requestRef: string; operator: string },
): Promise<Record<string, unknown> & { s3_keys: string[] }> {
  if (!keyOrNull()) throw new ErasureKeyMissing();
  const row = (
    await tx.query('SELECT name, phone FROM person WHERE tenant_id = $1 AND id = $2 FOR UPDATE', [
      args.tenantId,
      args.personId,
    ])
  ).rows[0];
  if (!row) throw new Error('erase_person: person not found');
  const name = row.name as string;
  if (normaliseName(name) === 'former staff') {
    throw new Error('erase_person: this person is already erased');
  }
  const result = await tx.query('SELECT erase_person($1, $2, $3, $4, $5, $6) AS r', [
    args.tenantId,
    args.personId,
    args.requestRef,
    args.operator,
    erasureHash(args.tenantId, name, row.phone as string | null),
    erasureNameHash(args.tenantId, name),
  ]);
  return result.rows[0].r;
}
