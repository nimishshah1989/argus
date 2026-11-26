// @vitest-environment node
import { createElement as h, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { realT } from '../printed-page/test-support.js';
import { mineModel, pmModel, type ListsContext } from './lists-adapter.js';
import { listHandback, listMachine, listMe, listTicket } from './lists-fixture.js';
import { MineView, PmJobsView } from './ListsView.js';

const NOW = '2026-11-13T11:10:00.000Z';
const ctx = (over: Partial<ListsContext> = {}): ListsContext => ({
  me: listMe(),
  machines: [listMachine('machine-1', 'VC-17')],
  nowIso: NOW,
  state: 'ready',
  paging: { hasNext: false, fetching: false },
  ...over,
});
const noop = () => undefined;
const draw = (node: ReactNode) =>
  renderToStaticMarkup(
    h(QueryClientProvider, { client: new QueryClient() }, h(MemoryRouter, null, node)),
  );
const count = (html: string, re: RegExp) => html.match(re)?.length ?? 0;

const rows = [
  listTicket({
    id: 't2',
    ref: 'BD-0152',
    problem: 'Oil leak',
    reportedAt: '2026-11-13T10:00:00.000Z',
  }),
  listTicket({
    id: 't1',
    ref: 'BD-0150',
    status: 'closed',
    startedAt: '2026-11-13T09:10:00.000Z',
    closedAt: '2026-11-13T10:30:00.000Z',
    handback: listHandback(),
  }),
];
const mine = (role = 'operator') =>
  draw(
    h(MineView, {
      model: mineModel(rows, ctx({ me: listMe({ role }) }), realT),
      on: { more: noop, cancel: noop, yes: noop, no: noop },
    }),
  );

describe('S27-B My complaints renders what the e2e specs find', () => {
  it('one h2 title, no h1, one list item per ticket carrying its REF', () => {
    const html = mine();
    expect(count(html, /<h1[\s>]/g)).toBe(0);
    expect(count(html, /<h2[\s>]/g)).toBe(1);
    expect(html).toContain(realT('floor.complaints'));
    const items = html.split('<li').slice(1);
    expect(items).toHaveLength(2);
    expect(items[0]).toContain('BD-0152');
    expect(items[0]).toContain('Oil leak');
    expect(items[0]).toContain(realT('status.floor.booked'));
    expect(items[1]).toContain('BD-0150');
  });

  it('an operator gets Cancel on the open ticket and the ask on the closed one', () => {
    const html = mine();
    expect(count(html, new RegExp(`>${realT('action.cancel')}</button>`, 'g'))).toBe(1);
    expect(html).toContain(realT('signoff.ask'));
    expect(html).toContain(realT('signoff.yes'));
    expect(html).toContain(realT('signoff.no'));
  });

  it('a technician never sees the ask', () => {
    const html = mine('technician');
    expect(html).not.toContain(realT('signoff.ask'));
    expect(html).not.toContain(realT('signoff.yes'));
  });

  it('an empty list says so', () => {
    const html = draw(
      h(MineView, {
        model: mineModel([], ctx({ state: 'empty' }), realT),
        on: { more: noop, cancel: noop, yes: noop, no: noop },
      }),
    );
    expect(html).toContain(realT('floor.complaintsEmpty'));
  });
});

describe('S27-B PM jobs renders what the e2e specs find', () => {
  it('h2 title, each job one link to /desk/:id holding code, REF and pill', () => {
    const jobs = [
      listTicket({
        id: 'p1',
        ref: 'WR-PM-0001',
        raisedChannel: 'pm',
        kind: 'general',
        problem: 'Monthly oil and filter',
        machineSnapshot: { code: 'CMP-01', category: null, cell: null },
      }),
    ];
    const html = draw(
      h(PmJobsView, {
        model: pmModel(jobs, ctx({ me: listMe({ role: 'technician' }) }), realT),
        on: { more: noop },
      }),
    );
    expect(count(html, /<h1[\s>]/g)).toBe(0);
    expect(html).toContain(realT('pm.jobs.title'));
    const link = html.split('href="/desk/p1"')[1]?.split('</a>')[0] ?? '';
    for (const text of [
      'CMP-01',
      'WR-PM-0001',
      realT('status.floor.booked'),
      'Monthly oil and filter',
    ])
      expect(link).toContain(text);
  });
});
