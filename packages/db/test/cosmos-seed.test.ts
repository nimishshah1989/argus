import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedCosmos } from '../../../scripts/seed-cosmos.js';

let container: StartedPostgreSqlContainer;
let pool: Pool;

const paths = {
  exportPath: fileURLToPath(
    new URL(
      '../../../docs/discovery/source/cosmos-platform-export-2026-10-28.json',
      import.meta.url,
    ),
  ),
  livePath: fileURLToPath(
    new URL('../../../docs/discovery/bhavin-v3/live-config-2026-11-09.json', import.meta.url),
  ),
  glossaryPath: fileURLToPath(
    new URL('../../../docs/discovery/bhavin-v3/glossary-2026-11-09.json', import.meta.url),
  ),
};

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  pool = new Pool({ connectionString: container.getConnectionUri(), max: 1 });
  await pool.query(
    readFileSync(new URL('../migrations/0001_schema_v1.sql', import.meta.url), 'utf8'),
  );
}, 120_000);

afterAll(async () => {
  await pool.end();
  await container.stop();
});

describe('cosmos seed', () => {
  it('loads 192 machines by segment, 14 people and 19 active codes', async () => {
    const report = await seedCosmos(pool, paths);
    expect(report.counts.machines).toBe(192);
    expect(report.counts.people).toBe(14);
    expect(report.counts.codes_active).toBe(19);
    expect(report.counts.codes_inactive).toBe(3);

    const machines = await pool.query(
      `SELECT s.code AS segment, count(*)::int AS n FROM machine m JOIN segment s ON s.id = m.segment_id GROUP BY s.code ORDER BY s.code`,
    );
    const bySegment = Object.fromEntries(machines.rows.map((row) => [row.segment, row.n]));
    expect(bySegment).toEqual({
      CNC: 125,
      Conventional: 16,
      DG: 3,
      Process: 17,
      Robot: 1,
      Utility: 30,
    });

    const people = await pool.query(
      'SELECT team, count(*)::int AS n FROM person GROUP BY team ORDER BY team',
    );
    expect(Object.fromEntries(people.rows.map((row) => [row.team, row.n]))).toEqual({
      maintenance: 13,
      vendor: 1,
    });

    const codes = await pool.query(
      "SELECT count(*) FILTER (WHERE active)::int AS active, count(*) FILTER (WHERE NOT active)::int AS inactive FROM list_item WHERE list = 'maint_code'",
    );
    expect(codes.rows[0]).toEqual({ active: 19, inactive: 3 });
  });

  it('loads shifts and glossary and is idempotent', async () => {
    await seedCosmos(pool, paths);
    const shifts = await pool.query('SELECT count(*)::int AS n FROM shift');
    expect(shifts.rows[0].n).toBe(2);
    const glossary = await pool.query('SELECT count(*)::int AS n FROM glossary_term');
    expect(glossary.rows[0].n).toBe(144);
    await seedCosmos(pool, paths);
    const machines = await pool.query('SELECT count(*)::int AS n FROM machine');
    expect(machines.rows[0].n).toBe(192);
  });
});
