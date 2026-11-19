import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n/index.js';
import { ApiError } from '../../data/index.js';

const asked = vi.hoisted(() => ({ runs: [] as string[][], failRun: -1 }));

vi.mock('../../api.js', () => ({
  getDrill: async (_type: string, ids: readonly string[]) => {
    asked.runs.push([...ids]);
    if (asked.runs.length - 1 === asked.failRun) throw new Error('refused');
    return { rows: ids.map((id) => ({ id, code: `M-${id}`, cell: '1' })) };
  },
}));

const { EnergyRows, chunkIds, fetchMachineRows, machinePage } = await import('./energy-rows.js');

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

describe('the panel table of a large tile', () => {
  it('pages 450 machines 50 at a time, in the engine order across the three runs, without throwing', async () => {
    const rows = await fetchMachineRows(ids(450));
    const first = machinePage(rows, undefined, 0);
    expect(first.total).toBe(450);
    expect(first.pages).toBe(9);
    expect(first.rows).toHaveLength(50);
    expect(first.rows.map((row) => row.id)).toEqual(ids(450).slice(0, 50));
    const last = machinePage(rows, undefined, 8);
    expect(last.rows.map((row) => row.id)).toEqual(ids(450).slice(400));
    const middle = machinePage(rows, undefined, 4);
    expect(middle.rows.map((row) => row.id)).toEqual(ids(450).slice(200, 250));
  });

  it('keeps a page inside the range and sorts across all pages', async () => {
    const rows = await fetchMachineRows(ids(450));
    expect(machinePage(rows, undefined, 99).page).toBe(8);
    const sorted = machinePage(rows, { column: 'code', dir: 'desc' }, 0);
    expect(sorted.rows[0]!.code).toBe('M-449');
    expect(sorted.rows).toHaveLength(50);
  });
});

const KEY = 'analytics-energy-rows';

function panel(prepare: (client: QueryClient) => void, ids: string[]): string {
  const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } });
  prepare(client);
  return renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client },
      h(MemoryRouter, null, h(EnergyRows, { ids, caption: 'Machine-wise Load — Cell 1' })),
    ),
  );
}

describe('the energy panel states', () => {
  it('fails as a whole when one run of a large tile is refused, and says so without throwing', async () => {
    asked.runs.length = 0;
    asked.failRun = 1;
    await expect(fetchMachineRows(ids(450))).rejects.toThrow('refused');
    asked.failRun = -1;
    const page = panel(
      (client) =>
        client
          .getQueryCache()
          .build(client, { queryKey: [KEY, ['a']], queryFn: async () => [] })
          .setState({ status: 'error', error: new ApiError('boom', 'bad'), data: undefined }),
      ['a'],
    );
    expect(page).toContain('role="alert"');
    expect(page).toContain('Could not load');
  });

  it('shows loading while the machines are on their way', () => {
    const page = panel(() => {}, ['a']);
    expect(page).toContain('Loading');
    expect(page).not.toContain('<table');
  });

  it('says there are no rows for a tile with no machines', () => {
    const page = panel((client) => client.setQueryData([KEY, []], []), []);
    expect(page).toContain('No rows.');
    expect(page).not.toContain('<table');
  });
});
