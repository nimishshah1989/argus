import type { CrudRow, CrudSpec } from './crud-spec.js';

/** The little of a query client a write needs, so this stays testable without React. */
export interface QueryInvalidator {
  invalidateQueries(filters: { queryKey: string[] }): Promise<unknown>;
}

/** After a write: the spec's own list, then every extra key it names (a wait reason also refreshes `config`). */
export async function invalidateAfterWrite(
  client: QueryInvalidator,
  spec: Pick<CrudSpec<CrudRow>, 'key' | 'invalidates'>,
): Promise<void> {
  const keys = [spec.key, ...(spec.invalidates ?? [])];
  await Promise.all(keys.map((key) => client.invalidateQueries({ queryKey: [key] })));
}
