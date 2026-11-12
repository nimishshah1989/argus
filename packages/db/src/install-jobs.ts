import { PgBoss, type Db } from 'pg-boss';
import type { Pool } from 'pg';

export const JOB_SCHEMA = 'pgboss';

/** Install pg-boss with the migration role, then grant only runtime queue access. */
export async function installJobSchema(pool: Pool): Promise<void> {
  const db: Db = { executeSql: (text, values) => pool.query(text, values) };
  const installer = new PgBoss({
    db,
    schema: JOB_SCHEMA,
    migrate: true,
    schedule: false,
    supervise: false,
    openTelemetry: { enabled: false },
  });
  await installer.start();
  await installer.stop({ close: false });
  await pool.query(`
    GRANT USAGE ON SCHEMA pgboss TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO app_user;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgboss TO app_user;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pgboss TO app_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT EXECUTE ON FUNCTIONS TO app_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT USAGE, SELECT ON SEQUENCES TO app_user;
  `);
}
