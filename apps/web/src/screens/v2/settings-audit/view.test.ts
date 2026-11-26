// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { AuditRow } from '@uptimo/shared/audit';
import '../../../i18n/index.js';
import { formatDateTime } from '../../../components/format.js';
import { change } from './fixture-rows.js';
import { AuditView, Lead } from './View.js';

/** Ticket 842: the post-merge review of #839 (S26-5). Rendered once, as the screen first draws. */
const TZ = 'Asia/Kolkata';
const recent = (n: number, entity = 'shift') =>
  Array.from({ length: n }, (_, i) =>
    change(new Date(Date.now() - (i + 1) * 3_600_000).toISOString(), entity, 'Admin A'),
  );

function render(role: string, rows: AuditRow[], more: boolean): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['me'], { user: { role } });
  client.setQueryData(['config'], { timeZone: TZ });
  client.setQueryData(['audit', 'list', {}], {
    pages: [{ items: rows, nextCursor: more ? 'older' : null }],
    pageParams: [undefined],
  });
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client }, createElement(AuditView)),
  );
}

describe('S26-5 fixes: the audit trail screen', () => {
  it('shows Export only to the admin; the head reads without it', () => {
    expect(render('admin', recent(3), false)).toContain('Export CSV');
    expect(render('head', recent(3), false)).not.toContain('Export CSV');
  });

  it('hides the 7-day takeaway while a filter is set, and shows it when none is', () => {
    const rows = recent(3);
    const lead = (filtered: boolean) =>
      renderToStaticMarkup(createElement(Lead, { rows, hasMore: false, filtered }));
    expect(lead(false)).toContain('Last 7 days');
    expect(lead(true)).toBe('');
  });

  it('offers "Older changes" only on the last table page, where the loaded rows end', () => {
    expect(render('admin', recent(25), true)).not.toContain('Older changes');
    expect(render('admin', recent(3), true)).toContain('Older changes');
    expect(render('admin', recent(3), false)).not.toContain('Older changes');
  });

  it('draws the area as a pill', () => {
    expect(render('admin', recent(1, 'machine'), false)).toMatch(
      /<span class="v2-pill v2-pill-neutral">Machines<\/span>/,
    );
  });

  it('names each row expand by its action, area and time, not the action alone', () => {
    const [row] = recent(1, 'machine');
    const when = formatDateTime(row!.at, TZ);
    expect(render('admin', [row!], false)).toContain(
      `aria-label="Show detail: Update · Machines · ${when}"`,
    );
  });
});

describe('S26-5 fixes: the coverage table says what v2 really does', () => {
  const doc = readFileSync(
    new URL('../../../../../../docs/design/v2/scope/settings-audit.md', import.meta.url),
    'utf8',
  );
  it('does not claim kit table filters or a Why that opens in place', () => {
    expect(doc).not.toMatch(/kit table filters/i);
    expect(doc).not.toMatch(/opens in place/i);
  });
  it('lists the area, person, from and to filters', () => {
    for (const word of ['Area', 'Person', 'From', 'To']) expect(doc).toContain(word);
    expect(doc).toMatch(/SelectField/);
    expect(doc).toMatch(/DateField/);
  });
});
