import { describe, expect, it } from 'vitest';
import { invalidateAfterWrite } from './crud-write.js';

const client = (seen: string[][]) => ({
  invalidateQueries: async ({ queryKey }: { queryKey: string[] }) => {
    seen.push(queryKey);
  },
});

describe('a write refreshes the list and the keys its spec names', () => {
  it('invalidates its own key and every extra key', async () => {
    const seen: string[][] = [];
    await invalidateAfterWrite(client(seen), {
      key: 'list-wait_reason',
      invalidates: ['config'],
    });
    expect(seen).toEqual([['list-wait_reason'], ['config']]);
  });

  it('invalidates just its own key when the spec names none', async () => {
    const seen: string[][] = [];
    await invalidateAfterWrite(client(seen), { key: 'machines' });
    expect(seen).toEqual([['machines']]);
  });
});
