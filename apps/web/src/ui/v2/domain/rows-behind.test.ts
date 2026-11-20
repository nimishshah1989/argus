// @vitest-environment node
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  drillReplySchema,
  machineDrillRowSchema,
  moveDrillRowSchema,
  ticketDrillRowSchema,
  type DrillReply,
} from '@uptimo/shared/analytics';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import replies from '../../../gallery/rows-behind/generated/replies.json' with { type: 'json' };
import { adapterWords, tableWords } from '../../../gallery/rows-behind/words.js';
import { BulletBar } from '../bullet-bar.js';
import type { Drill } from '../drill.js';
import { KpiCard, type KpiData } from '../kpi-card.js';
import { Pareto } from '../pareto.js';
import { rowsBehindModel, REPLY_FIELDS } from './rows-behind-adapter.js';
import { RowsBehind, type RowsBehindModel } from './rows-behind.js';
import { bullet, kpis, pareto } from '../../../gallery/rows-behind/data.js';

const html = (el: ReactElement) => renderToStaticMarkup(el);
const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

const figures = replies.figures as Record<string, { value: unknown; reply: unknown }>;
const codes = replies.machineCodes as Record<string, string>;
const reply = (key: string): DrillReply => drillReplySchema.parse(figures[key]?.reply);

function model(key: string, replyOf: DrillReply = reply(key)): RowsBehindModel {
  const built = rowsBehindModel({
    figure: { key, label: 'A figure', value: '759.3 hrs' },
    reply: replyOf,
    asOf: replies.asOf,
    machineCode: (id) => codes[id],
    words: adapterWords,
  });
  if (!built) throw new Error(`no rows behind ${key}`);
  return built;
}
const ready = (m: RowsBehindModel) => ({ state: 'ready' as const, model: m, retry: () => {} });

describe('the real drill replies the panel is built from', () => {
  it('are what GET /analytics/drill answers, one reply of each type, and name only machines the plant has', () => {
    const types = Object.keys(figures).map((key) => reply(key).type);
    expect(new Set(types)).toEqual(new Set(['machine', 'ticket', 'move']));
    for (const key of Object.keys(figures))
      for (const row of reply(key).rows)
        if ('machineId' in row && row.machineId !== null)
          expect(codes[row.machineId]).toBeDefined();
  });

  it('are counted by the figure: the PM hours are the downtime of the tickets behind them', () => {
    const minutes = reply('dashboard.pm-hours').rows.reduce(
      (sum, row) => sum + ('downtimeMin' in row ? (row.downtimeMin ?? 0) : 0),
      0,
    );
    expect(minutes / 60).toBeCloseTo(figures['dashboard.pm-hours']!.value as number, 1);
  });
});

describe('every field of a drill reply is shown or left to the thing the row opens', () => {
  const schemas = {
    machine: machineDrillRowSchema,
    ticket: ticketDrillRowSchema,
    move: moveDrillRowSchema,
  };
  for (const [type, schema] of Object.entries(schemas)) {
    it(`for ${type} rows`, () => {
      const { shown, elsewhere } = REPLY_FIELDS[type as keyof typeof REPLY_FIELDS];
      expect([...shown, ...elsewhere].sort()).toEqual(Object.keys(schema.shape).sort());
      expect(shown.filter((field) => elsewhere.includes(field))).toEqual([]);
    });
  }
});

describe('rowsBehindModel', () => {
  it('says which figure and its exact value, what was counted, and where from, as of the plant date', () => {
    const m = model('dashboard.pm-hours');
    expect(m).toMatchObject({ figure: 'dashboard.pm-hours', value: '759.3 hrs' });
    expect(m.counted).toBe('64 tickets counted');
    expect(m.source).toBe('Counted from the plant records, as of 11-Nov-2026');
  });

  it('prints a ticket as its link, its machine as a chip and its downtime in hours, sorted by the number', () => {
    const m = model('dashboard.pm-hours');
    const row = m.rows[0]!;
    expect(row.cells.ticket).toMatchObject({
      text: expect.any(String),
      href: expect.stringMatching(/^\/desk\//),
    });
    expect(row.cells.machine?.chip).toMatchObject({ kind: 'machine' });
    expect(row.cells.downtime?.text).toMatch(/^\d[\d,]*\.\d h$/);
    const minutes = (reply('dashboard.pm-hours').rows[0] as { downtimeMin: number }).downtimeMin;
    expect(row.cells.downtime?.sort).toBe(minutes);
    expect(row.cells.reported?.text).toMatch(/^\d{2}-[A-Z][a-z]{2}-\d{4}$/);
    expect(m.columns.filter((c) => c.sortable).length).toBeGreaterThanOrEqual(5);
  });

  it('prints a machine as its chip with its cell as a chip, and a move with both cells', () => {
    const machine = model('dashboard.conventional-machines').rows[0]!;
    expect(machine.cells.machine?.chip).toMatchObject({ kind: 'machine', label: machine.key });
    expect(machine.cells.cell?.chip).toMatchObject({ kind: 'cell' });
    expect(machine.open).toEqual({ chip: machine.cells.machine?.chip });
    const move = model('cell-change-log').rows[0]!;
    expect(move.cells.from?.chip?.kind).toBe('cell');
    expect(move.cells.to?.chip?.kind).toBe('cell');
    expect(move.cells.machine?.chip?.kind).toBe('machine');
  });

  it('never prints an id: no printed word, row key or link text is a UUID', () => {
    for (const key of Object.keys(figures)) {
      const m = model(key);
      const words = m.rows.flatMap((r) => [r.key, ...Object.values(r.cells).map((c) => c.text)]);
      expect(words.filter((w) => UUID.test(w))).toEqual([]);
    }
  });

  it('offers two to four filter chips when the rows split that way, and none when they do not', () => {
    expect(model('dashboard.breakdown-free').filters).toEqual([]);
    const mixed: DrillReply = {
      type: 'machine',
      rows: [
        ...reply('dashboard.conventional-machines').rows,
        ...reply('dashboard.process-machines').rows,
      ],
    };
    expect(model('mixed', mixed).filters.map((f) => f.label)).toEqual(['Conventional', 'Process']);
  });

  it('has nothing to show when the figure counted nothing, so the screen shows its empty state', () => {
    const none: DrillReply = { type: 'ticket', rows: [] };
    expect(
      rowsBehindModel({
        figure: { key: 'x', label: 'x', value: '0' },
        reply: none,
        asOf: replies.asOf,
        machineCode: () => undefined,
        words: adapterWords,
      }),
    ).toBeNull();
  });

  it('names a machine the plant does not have with a dash, never its id', () => {
    const unknown = rowsBehindModel({
      figure: { key: 'x', label: 'x', value: '1' },
      reply: { type: 'ticket', rows: reply('dashboard.pm-hours').rows.slice(0, 1) },
      asOf: replies.asOf,
      machineCode: () => undefined,
      words: adapterWords,
    });
    expect(unknown?.rows[0]?.cells.machine).toEqual({ text: '—' });
  });
});

describe('the panel', () => {
  const panel = (loaded: Parameters<typeof RowsBehind>[0]['loaded']) =>
    html(createElement(RowsBehind, { loaded, words: tableWords }));

  it('opens with the figure and its exact value, shows ten rows of 64 with search and a pager, and ends with the source', () => {
    const out = panel(ready(model('dashboard.pm-hours')));
    expect(out).toMatch(/<h2 class="v2-drawer-title">A figure<\/h2>/);
    expect(text(out)).toContain('64 tickets counted');
    expect(text(out)).toContain('759.3 hrs');
    expect(out.match(/<tbody[\s\S]*<\/tbody>/)?.[0].match(/<tr/g)).toHaveLength(10);
    expect(text(out)).toContain('1–10 of 64');
    expect(out).toMatch(/<input type="search" aria-label="Search these rows"/);
    expect(
      out.match(/<th[^>]*scope="col"[^>]*><button[^>]*class="v2-sort"/g)?.length,
    ).toBeGreaterThanOrEqual(5);
    expect(text(out.slice(out.lastIndexOf('v2-source')))).toContain('as of 11-Nov-2026');
  });

  it('says it is loading, announces an error with a way to try again, and says when nothing is counted', () => {
    expect(panel({ state: 'loading', retry: () => {} })).toMatch(/role="status"/);
    expect(panel({ state: 'error', retry: () => {} })).toMatch(/role="alert"[\s\S]*<button/);
    expect(text(panel({ state: 'empty', retry: () => {} }))).toContain(tableWords.empty);
  });
});

describe('a figure that declares its drill', () => {
  const drill: Drill = { figure: 'dashboard.pm-hours', label: 'Show the rows behind PM hours' };

  it('opens from a KPI card by its value, which says the figure and where it leads', () => {
    const kpi: KpiData = { ...kpis[0]!, drill };
    const out = html(createElement(KpiCard, { kpi }));
    expect(out).toMatch(
      /<button[^>]*class="v2-kpi-value v2-drill-value"[^>]*aria-label="759\.3 hrs\. Show the rows behind PM hours"/,
    );
    expect(html(createElement(KpiCard, { kpi: { ...kpi, drill: undefined } }))).not.toContain(
      'v2-drill-value',
    );
  });

  it('opens from each Pareto bar that has rows behind it, and from a bullet bar beside its Why', () => {
    const bars = html(createElement(Pareto, { data: pareto, whyLabel: 'Why', actions: null }));
    expect(bars.match(/<button[^>]*class="v2-bar-drill"/g)).toHaveLength(pareto.bars.length);
    const bar = html(createElement(BulletBar, { b: bullet }));
    expect(bar).toMatch(
      /<button[^>]*class="v2-icon-btn v2-drill-btn"[^>]*aria-label="Show the rows behind Machines with no breakdown"/,
    );
    const plain = html(createElement(BulletBar, { b: { ...bullet, drill: undefined } }));
    expect(plain).not.toContain('v2-drill-btn');
  });
});
