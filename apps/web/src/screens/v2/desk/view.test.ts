// @vitest-environment node
import { createElement as h, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { realT } from '../printed-page/test-support.js';
import { openModel } from './adapter.js';
import { deskFixture } from './fixture.js';
import { OpenView } from './View.js';

/**
 * S28-A (ADR 0045 T3), render-smoke (ADR 0034): the Open screen draws the frozen plant, every card linking to its
 * ticket. Names, words and control order are pinned by the e2e specs (desk-lists, desk, tasks, desk-two-pane,
 * gallery/desk-order), not here.
 */
function draw(): string {
  const view = h(OpenView, {
    model: openModel(deskFixture, realT),
    pending: false,
    onFilter: () => undefined,
    onSegment: () => undefined,
    onQuick: () => undefined,
  });
  return renderToStaticMarkup(
    h(QueryClientProvider, { client: new QueryClient() }, h(MemoryRouter, null, view as ReactNode)),
  );
}

describe('the Open screen renders', () => {
  it('draws every breakdown, the paused job and the report still owed, each linking to its ticket', () => {
    const html = draw();
    for (const [id, ref] of [
      ['t1', 'TKT-0401'],
      ['t3', 'TKT-0409'],
      ['t2', 'TKT-0413'],
      ['t4', 'TKT-0398'],
      ['t5', 'TKT-0390'],
      ['t11', 'TKT-0380'],
    ]) {
      expect(html, ref).toContain(ref);
      expect(html, ref).toContain(`href="/desk/${id}"`);
    }
  });

  it('draws no ticket pane of its own: a wide screen opens the ticket in the Shell drawer (ADR 0056)', () => {
    expect(draw()).not.toContain('aria-label="Ticket"');
  });
});
