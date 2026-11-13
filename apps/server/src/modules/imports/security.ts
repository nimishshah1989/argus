import type { Pool } from 'pg';

export type CliCommand =
  | { mode: 'import'; file: string; tenantSlug: string; productionConfirm: boolean }
  | {
      mode: 'undo';
      batchId: string;
      tenantSlug: string;
      productionConfirm: boolean;
      operator: string;
    };

export class CliUsageError extends Error {
  readonly exitCode = 2;

  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

interface CliTokens {
  target: string | undefined;
  tenantSlug: string | undefined;
  productionConfirm: boolean;
  operator: string | undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const ROLE_QUERY =
  'SELECT current_user AS name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user';

function invalid(message: string): never {
  throw new CliUsageError(message);
}

function parseTokens(argv: string[], start: number): CliTokens {
  let target: string | undefined;
  let tenantSlug: string | undefined;
  let productionConfirm = false;
  let operator: string | undefined;
  for (let index = start; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--tenant') {
      if (tenantSlug !== undefined) invalid('duplicate --tenant');
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) invalid('--tenant requires a slug');
      tenantSlug = value;
      index += 1;
    } else if (arg === '--operator') {
      if (operator !== undefined) invalid('duplicate --operator');
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) invalid('--operator requires a name');
      operator = value;
      index += 1;
    } else if (arg === '--production-confirm') {
      if (productionConfirm) invalid('duplicate --production-confirm');
      productionConfirm = true;
    } else if (arg?.startsWith('-')) {
      invalid(`unknown flag: ${arg}`);
    } else if (target !== undefined) {
      invalid('extra positional argument');
    } else {
      target = arg;
    }
  }
  return { target, tenantSlug, productionConfirm, operator };
}

export function parseCliArgs(argv: string[]): CliCommand {
  const mode = argv[0] === 'undo' ? 'undo' : 'import';
  const tokens = parseTokens(argv, mode === 'undo' ? 1 : 0);
  const { target, tenantSlug, productionConfirm, operator } = tokens;
  if (!target) invalid(`${mode} target is required`);
  if (!tenantSlug || !SLUG.test(tenantSlug)) invalid('a valid --tenant slug is required');
  if (mode === 'undo') {
    if (!UUID.test(target)) invalid('batch id must be a canonical UUID');
    if (!operator?.trim()) invalid('undo requires --operator');
    return { mode, batchId: target, tenantSlug, productionConfirm, operator };
  }
  if (operator !== undefined) invalid('--operator applies to undo only');
  return { mode, file: target, tenantSlug, productionConfirm };
}

export function assertProductionAccess(command: CliCommand, appEnv: string | undefined): void {
  if (appEnv === 'staging' || command.productionConfirm) return;
  throw new Error('write commands require APP_ENV=staging or --production-confirm');
}

function roleFailure(): Error {
  return new Error('CLI requires the app_api role without superuser or RLS bypass');
}

export async function assertAppApiRole(pool: Pool): Promise<void> {
  let client;
  try {
    client = await pool.connect();
  } catch {
    throw roleFailure();
  }
  try {
    const result = await client.query(ROLE_QUERY).catch(() => {
      throw roleFailure();
    });
    const row = result.rows[0] as
      { name?: string; rolsuper?: boolean; rolbypassrls?: boolean } | undefined;
    if (
      result.rows.length !== 1 ||
      row?.name !== 'app_api' ||
      row.rolsuper !== false ||
      row.rolbypassrls !== false
    ) {
      throw roleFailure();
    }
  } finally {
    client.release();
  }
}

const ROUTER_QUERY = `SELECT current_user AS name, pg_has_role(current_user, 'app_router', 'USAGE') AS router,
  pg_has_role(current_user, 'app_user', 'MEMBER') AS app_user`;

function routerFailure(): Error {
  return new Error(
    'import:undo requires ROUTER_DATABASE_URL: a login that is a member of app_router and app_user',
  );
}

export async function assertRouterRole(pool: Pool): Promise<void> {
  let client;
  try {
    client = await pool.connect();
  } catch {
    throw routerFailure();
  }
  try {
    const result = await client.query(ROUTER_QUERY).catch(() => {
      throw routerFailure();
    });
    const row = result.rows[0] as
      { name?: string; router?: boolean; app_user?: boolean } | undefined;
    if (
      result.rows.length !== 1 ||
      row?.name === 'app_api' ||
      row?.router !== true ||
      row.app_user !== true
    ) {
      throw routerFailure();
    }
  } finally {
    client.release();
  }
}
