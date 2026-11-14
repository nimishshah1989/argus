import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ARCHITECTURE §9 items 28 and 29 (ticket 29): `person.kind`, `ticket.sla_policy_id` and `ticket.handback_status`
// repeat what another place already says (the person's team, the ticket's severity, the handback events), so
// nothing reads or writes them. The columns go in the M4a migration. A migration may still name them.
const SKIP = new Set(['node_modules', 'dist', 'coverage', 'generated', 'migrations']);

/** Statement text that reads or writes one of the three retired columns. */
const RETIRED: readonly RegExp[] = [
  /\bsla_policy_id\b/,
  /\bhandback_status\b/,
  /\b(?:INSERT INTO|UPDATE|FROM|JOIN)\s+person\b[^;`]*\bkind\b/i,
  /\bp\.kind\b/,
];

function codeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return SKIP.has(entry.name) || entry.name === 'test' ? [] : codeFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const reads = (text: string): boolean => RETIRED.some((pattern) => pattern.test(text));

describe('retired columns stay unused', () => {
  it('recognises each way of using them', () => {
    expect(reads('UPDATE ticket SET sla_policy_id = $1')).toBe(true);
    expect(reads('SELECT handback_status FROM ticket')).toBe(true);
    expect(reads("INSERT INTO person (name, team, kind) VALUES ('a', 'b', 'staff')")).toBe(true);
    expect(reads('SELECT p.kind FROM person p')).toBe(true);
  });

  it('does not mistake a ticket’s kind or a person link for them', () => {
    expect(reads('INSERT INTO ticket (ref, kind, reported_by_person_id) VALUES ($1, $2, $3)')).toBe(
      false,
    );
    expect(reads('SELECT t.kind FROM ticket t JOIN person p ON p.id = t.lead_person_id')).toBe(
      false,
    );
  });

  it('finds none in the server, the shared contract or the scripts', () => {
    const found = [
      'apps/server/src',
      'packages/shared/src',
      'packages/domain/src',
      'packages/db/src',
      'scripts',
    ]
      .flatMap(codeFiles)
      .filter((path) => reads(readFileSync(path, 'utf8')));
    expect(found).toEqual([]);
  });
});
