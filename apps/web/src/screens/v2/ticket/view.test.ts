// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import type { Me } from '../../../api.js';
import { realT } from '../printed-page/test-support.js';
import { CONFIG, fixtureInput, SUPERVISOR } from './fixture.js';
import { ticketModel } from './adapter.js';
import { TicketView } from './View.js';

/**
 * Ticket 771 render smoke (ADR 0034): the page draws with the selectors the e2e specs read, and the board login gets
 * no action bar. Facts are read as `dt` → following `dd` (detail-downtime, closes, pm-plans), so one `dd` per `dt`.
 */
function draw(me: Me | undefined): string {
  const input = fixtureInput({}, me);
  return renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client: new QueryClient() },
      h(
        MemoryRouter,
        null,
        h(TicketView, {
          model: ticketModel(input, realT),
          detail: input.detail,
          config: CONFIG,
          me,
          run: () => Promise.resolve(true),
          pending: false,
          error: null,
          onFlow: () => undefined,
        }),
      ),
    ),
  );
}

/** As renderToStaticMarkup escapes text. */
const esc = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

describe('S29 ticket page (render smoke)', () => {
  it('leaves the title, ref and back link to the Shell and Page, and draws the status chips in a header and a supervisor’s Actions bar', () => {
    const html = draw(SUPERVISOR);
    expect(html).not.toContain('<h1');
    expect(html).not.toContain('href="/desk"');
    const header = /<header[^>]*>(.*?)<\/header>/s.exec(html)?.[1] ?? '';
    const model = ticketModel(fixtureInput(), realT);
    for (const chip of model.chips) expect(header).toContain(esc(chip.text));
    expect(html).toContain('aria-label="Actions"');
    expect(html).toContain('Write report and close');
  });

  it('draws each fact and Minutes figure as its dt then one dd with exactly the value, no second dd', () => {
    const html = draw(SUPERVISOR);
    const model = ticketModel(fixtureInput(), realT);
    const pairs = [...model.facts, ...(model.minutes?.figures ?? [])];
    expect(pairs.length).toBeGreaterThan(3);
    for (const { label, value } of pairs) {
      const term = `>${esc(label)}</dt>`;
      const at = html.indexOf(term);
      expect(at, label).toBeGreaterThan(-1);
      const after = html.slice(at + term.length);
      expect(/^<dd[^>]*>(.*?)<\/dd>/s.exec(after)?.[1], label).toBe(esc(value));
      expect(after.replace(/^<dd[^>]*>.*?<\/dd>/s, '').startsWith('<dd'), label).toBe(false);
    }
  });

  it('gives the board login no Actions region and no Cancel ticket', () => {
    const html = draw({ ...SUPERVISOR, id: 'u9', role: 'board' });
    expect(html).not.toContain('aria-label="Actions"');
    expect(html).not.toContain('Cancel ticket');
  });
});
