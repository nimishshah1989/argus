import { describe, expect, it } from 'vitest';
import { tablePage } from './table-model.js';

/**
 * v1's Energy panel paged a 450-machine tile 50 at a time and was tested for it (`energy-rows.test.ts`). The rows
 * panel the tiles open in now is the kit's table; this holds the same promises to it: a large tile pages in order across
 * pages, sorts across all pages, keeps a page inside the range and never throws.
 */
const rows = Array.from({ length: 450 }, (_, at) => ({ code: `M-${at}`, at }));
const ask = (
  page: number,
  sortBy?: (row: (typeof rows)[number]) => number | string,
  dir?: 'asc' | 'desc',
) =>
  tablePage(rows, { query: '', text: (row) => row.code, page, ...(sortBy ? { sortBy, dir } : {}) });

describe('the rows a large tile opens', () => {
  it('pages 450 machines in the engine order, ten a page, the last page holding the rest', () => {
    const first = ask(1);
    expect(first.total).toBe(450);
    expect(first.pages).toBe(45);
    expect(first.rows.map((row) => row.at)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(ask(21).rows.map((row) => row.at)).toEqual(
      Array.from({ length: 10 }, (_, i) => 200 + i),
    );
    expect(ask(45).rows.at(-1)?.at).toBe(449);
  });

  it('keeps a page inside the range', () => {
    expect(ask(99).page).toBe(45);
    expect(ask(0).page).toBe(1);
  });

  it('sorts across all pages, not just the one in view', () => {
    const sorted = ask(1, (row) => row.code, 'desc');
    expect(sorted.rows[0]?.code).toBe('M-99');
    expect(sorted.rows).toHaveLength(10);
    const byNumber = ask(1, (row) => row.at, 'desc');
    expect(byNumber.rows[0]?.code).toBe('M-449');
  });
});
