import { describe, expect, it } from 'vitest';
import { migrationViolations } from './check-migration-immutability.js';

describe('migration immutability', () => {
  it('allows a new migration file', () => {
    expect(
      migrationViolations(
        'A\tpackages/db/migrations/0004_add_tasks.sql\nM\tapps/server/src/app.ts',
      ),
    ).toEqual([]);
  });

  it('fails a modified migration file', () => {
    expect(migrationViolations('M\tpackages/db/migrations/0001_schema_v1.sql')).toEqual([
      'packages/db/migrations/0001_schema_v1.sql (M)',
    ]);
  });

  it('fails a deleted migration file', () => {
    expect(migrationViolations('D\tpackages/db/migrations/0002_app_api_role.sql')).toEqual([
      'packages/db/migrations/0002_app_api_role.sql (D)',
    ]);
  });

  it('fails a renamed migration file', () => {
    expect(
      migrationViolations(
        'R100\tpackages/db/migrations/0002_app_api_role.sql\tpackages/db/migrations/0002_role.sql',
      ),
    ).toEqual(['packages/db/migrations/0002_app_api_role.sql (R100)']);
  });
});
