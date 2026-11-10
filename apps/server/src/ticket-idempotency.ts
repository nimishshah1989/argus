import type { PoolClient } from 'pg';

export async function getIdempotent(
  client: PoolClient,
  tenantId: string,
  key: string,
): Promise<{ status: number; body: unknown } | null> {
  const row = (
    await client.query('SELECT result FROM command_idempotency WHERE tenant_id = $1 AND key = $2', [
      tenantId,
      key,
    ])
  ).rows[0];
  return (row?.result as { status: number; body: unknown } | undefined) ?? null;
}

export async function storeIdempotent(
  client: PoolClient,
  tenantId: string,
  key: string,
  opts: { command: string; result: { status: number; body: unknown } },
): Promise<void> {
  await client.query(
    'INSERT INTO command_idempotency (tenant_id, key, command, result) VALUES ($1, $2, $3, $4)',
    [tenantId, key, opts.command, JSON.stringify(opts.result)],
  );
}

export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505';
}
