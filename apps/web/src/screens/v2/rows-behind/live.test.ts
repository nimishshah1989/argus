// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const asked = vi.hoisted(() => ({ runs: [] as string[][], failRun: -1, ids: [] as string[] }));

vi.mock('../figures/live.js', () => ({
  catalogue: (key: string) => key,
  liveCodes: async () => (id: string) => `M-${id}`,
  liveDrill: async (_client: unknown, type: string, ids: readonly string[]) => {
    asked.runs.push([...ids]);
    if (asked.runs.length - 1 === asked.failRun) throw new Error('refused');
    return {
      type,
      rows: ids.map((id) => ({
        id,
        code: `M-${id}`,
        cell: '1',
        category: null,
        make: null,
        model: null,
        year: null,
        status: 'active',
        segment: null,
      })),
    };
  },
  liveReply: async () => ({
    asOf: '2026-11-11',
    figures: [
      {
        key: 'a5-energy',
        screen: 'a5-energy',
        owner: 41,
        status: 'ready',
        value: {
          pages: [{ page: 'a5', title: 'Energy Heatmap', kpis: [], tables: [], charts: [] }],
          extra: {
            effFactorPct: 20,
            byCell: [
              {
                key: '1',
                machines: asked.ids.length,
                totalKva: 4500,
                avgKva: 10,
                runningKva: 900,
                avgRunningKva: 2,
                machineIds: asked.ids,
              },
              {
                key: '2',
                machines: 0,
                totalKva: 0,
                avgKva: 0,
                runningKva: 0,
                avgRunningKva: 0,
                machineIds: [],
              },
            ],
            byLocation: [],
          },
        },
        drill: { type: 'machine', ids: asked.ids },
      },
    ],
  }),
}));

const { liveRows } = await import('./live.js');
const ids = (count: number) => Array.from({ length: count }, (_, at) => String(at));

describe('the machines behind an energy tile, read from the server', () => {
  it('asks in runs of at most 200 ids, the most one drill ask may take, and gets every machine in the figure’s order', async () => {
    asked.ids = ids(450);
    asked.runs.length = 0;
    const model = await liveRows('a5-energy:cell:1', {});
    expect(asked.runs.map((run) => run.length)).toEqual([200, 200, 50]);
    expect(model?.rows.map((row) => row.key)).toEqual(ids(450).map((id) => `M-${id}`));
    expect(model?.value).toContain('4,500.0');
  });

  it('fails as a whole when one run of a large tile is refused, so the drawer says so', async () => {
    asked.ids = ids(450);
    asked.runs.length = 0;
    asked.failRun = 1;
    await expect(liveRows('a5-energy:cell:1', {})).rejects.toThrow('refused');
    asked.failRun = -1;
  });

  it('is nothing for a tile with no machines and for a tile the figure does not have', async () => {
    asked.ids = ids(3);
    asked.runs.length = 0;
    expect(await liveRows('a5-energy:cell:2', {})).toBeNull();
    expect(await liveRows('a5-energy:cell:9', {})).toBeNull();
    expect(asked.runs).toEqual([]);
  });
});
