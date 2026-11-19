import { describe, expect, it, vi } from 'vitest';

const asked = vi.hoisted(() => ({ runs: [] as string[][] }));

vi.mock('../../api.js', () => ({
  getDrill: async (_type: string, ids: readonly string[]) => {
    asked.runs.push([...ids]);
    return { rows: ids.map((id) => ({ id, code: `M-${id}`, cell: '1' })) };
  },
}));

const { chunkIds, fetchMachineRows } = await import('./energy-rows.js');

const ids = (count: number) => Array.from({ length: count }, (_, at) => String(at));

describe('the machines behind an energy tile', () => {
  it('asks in runs of at most 200 ids, the most one drill ask may take', () => {
    expect(chunkIds(ids(200)).map((run) => run.length)).toEqual([200]);
    expect(chunkIds(ids(201)).map((run) => run.length)).toEqual([200, 1]);
    expect(chunkIds(ids(450)).map((run) => run.length)).toEqual([200, 200, 50]);
    expect(chunkIds([])).toEqual([]);
  });

  it('gets every machine of a fleet over 200, in the figure order, with no ask over the limit', async () => {
    asked.runs.length = 0;
    const rows = await fetchMachineRows(ids(450));
    expect(rows).toHaveLength(450);
    expect(rows.map((row) => row.id)).toEqual(ids(450));
    expect(asked.runs.every((run) => run.length <= 200)).toBe(true);
    expect(asked.runs).toHaveLength(3);
  });
});
