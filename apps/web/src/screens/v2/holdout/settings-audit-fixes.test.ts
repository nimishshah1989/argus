// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { DataTable } from '../../../ui/v2/data-table.js';
import { NOW, change } from '../settings-audit/fixture-rows.js';
import { auditTakeaway, searchText } from '../settings-audit/model.js';

const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe('S26-5 fixes: edges (ticket 842)', () => {
  it('counts rows hours ahead of the browser clock, and still drops rows older than 7 days', () => {
    const rows = [
      change(at(3 * 3_600_000), 'machine', 'B'),
      change(at(-3_600_000), 'machine', 'B'),
      change(at(-8 * 86_400_000), 'machine', 'B'),
    ];
    expect(auditTakeaway(rows, false, NOW)).toEqual({
      count: 2,
      area: 'machine',
      areaCount: 2,
      by: 'B',
    });
  });

  it('still refuses a partial window when the only rows are ahead of the clock and more pages exist', () => {
    expect(auditTakeaway([change(at(60_000), 'shift', 'A')], true, NOW)).toBeNull();
  });

  it('search text carries every part, and never the text "undefined" or "null"', () => {
    const text = searchText('Delete', 'Machines', 'System', undefined);
    for (const part of ['Delete', 'Machines', 'System']) expect(text).toContain(part);
    expect(text).not.toMatch(/undefined|null/);
    expect(searchText('Delete', 'Machines', 'System', '')).not.toMatch(/undefined|null/);
  });

  it('a table one row past a page keeps `more` off page 1', () => {
    const html = renderToStaticMarkup(
      createElement(DataTable<{ id: string }>, {
        rows: Array.from({ length: 11 }, (_, i) => ({ id: `r${i}` })),
        rowKey: (row) => row.id,
        columns: [{ key: 'id', label: 'Id', cell: (row) => row.id }],
        filters: [],
        text: (row) => row.id,
        words: { title: 'T', search: 'S', showing: '{from}-{to} of {total}', noResults: 'None' },
        more: createElement('button', { type: 'button' }, 'LOAD-OLDER'),
      }),
    );
    expect(html).not.toContain('LOAD-OLDER');
  });
});
