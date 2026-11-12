import type { QueryClient } from '@tanstack/react-query';

/** Policy and wait-rule writes can re-arm every visible ticket projection. */
export function invalidateSlaData(queryClient: QueryClient): Promise<unknown[]> {
  return Promise.all(
    (['config', 'state', 'tickets', 'ticket'] as const).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey: [queryKey] }),
    ),
  );
}
