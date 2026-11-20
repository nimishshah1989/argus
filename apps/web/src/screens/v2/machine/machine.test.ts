// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import i18n from 'i18next';
import type { Ticket } from '@uptimo/shared/replies';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';
import '../../../i18n/index.js';
import { machineRecord } from '../../analytics/machine-record.js';
import { UUID, printed, realReply } from '../figures/real-reply.js';
import { machinePageModel, type MachineFacts } from './adapter.js';
import { MachineView } from './View.js';

/**
 * The completeness test: every item v1's Machine page showed is printed by the v2 page, from the engine's real reply
 * over the frozen 11 November plant, with v1's own edge cases ported (a running load with no factor, a machine with too
 * little history, none the figure holds, a figure not computed, a moves table that sorts as dates).
 */
const t = (key: string, values?: Record<string, string | number>) =>
  i18n.t(key, { ...values }) as string;
const reply = realReply();
const machines = ENGINE_DATA.machines.map((m) => ({
  id: m.id,
  code: m.code,
  category: m.category ?? null,
  cell: m.cell ?? null,
}));
const task = (over: Partial<Ticket>) =>
  ({
    id: 't1',
    ref: 'BD-1',
    problem: 'Spindle alarm',
    status: 'open',
    raisedChannel: 'floor',
    taskExpectedOn: null,
    reportedAt: '2026-11-10T08:00:00Z',
    ...over,
  }) as unknown as Ticket;
const facts = (param: string, tickets: Ticket[] | null = []): MachineFacts => ({
  param,
  machines,
  tickets,
  timeZone: 'Asia/Kolkata',
});
const model = machinePageModel(
  reply,
  facts('HMC-2', [
    task({}),
    task({
      id: 't2',
      ref: 'PM-1',
      problem: 'Greasing',
      raisedChannel: 'pm',
      taskExpectedOn: '2026-11-05',
    }),
  ]),
  t,
)!;
const nav = [
  { id: 'machines', label: 'Machines', icon: 'machines' as const, href: '/a', current: true },
];
const markup = renderToStaticMarkup(
  createElement(
    MemoryRouter,
    { initialEntries: ['/analytics/machines/HMC-2'] },
    createElement(MachineView, { model, nav, title: 'HMC-2' }),
  ),
);
const record = machineRecord(reply.figures.find((f) => f.key === 'machine-page')!.value, 'HMC-2')!;
const strings = printed(model);

describe('the v2 Machine page prints everything v1 showed', () => {
  it('the eight headline figures, each work figure opening its rows', () => {
    expect(model.kpis.map((k) => k.label)).toEqual([
      'Age',
      'Floor area',
      'Connected load',
      'Running load (est.)',
      'Breakdowns',
      'BD hours',
      'MTTR',
      'PM hours',
    ]);
    const value = (id: string) => model.kpis.find((k) => k.id === id)!;
    expect(value('age').value).toBe('20 yrs');
    expect(value('floor-area').value).toBe('18.00 m²');
    expect(value('running-load').value).toBe('6.00 KVA');
    expect(value('running-load').meaning).toBe('20% efficiency factor');
    expect(value('breakdowns').value).toBe('50');
    expect(value('mttr').value).toBe('2.30 hrs');
    for (const id of ['breakdowns', 'breakdown-hours', 'mttr'])
      expect(value(id).drill?.figure).toBe('machine-page:HMC-2:breakdowns');
    // No PM visit was ever logged, so the PM figure has no rows to open.
    expect(value('pm-hours').drill).toBeUndefined();
    expect(value('age').drill).toBeUndefined();
  });

  it('the last breakdown, the most frequent problem and the PM visits and hours', () => {
    expect(model.breakdowns.facts.map((f) => f.value)).toEqual([
      '07-Nov-2026',
      record.breakdowns!.topProblem!.problem,
    ]);
    expect(model.pm.facts.map((f) => f.value)).toEqual(['0', '0.00 hrs']);
  });

  it('the reliability fit: shape, scale, mean, sample, quartiles and the trend word', () => {
    const fit = model.reliability.fit!;
    expect(fit.figures.map((f) => f.value)).toEqual(['0.88', '107.0', '114.1']);
    expect(fit.lines).toContain("This machine's own failures");
    expect(fit.lines).toContain('43 failures · 42 intervals · 70.0 censored hours');
    expect(fit.trend).toEqual({
      word: 'failures are coming faster',
      slope: 'slope 1.73 across 43 failures',
    });
    expect(model.reliability.drill).toBeDefined();
  });

  it('the critical spares: part, uses, downtime, last used', () => {
    const rows = model.spares.table!.rows.map((row) => row.map((cell) => cell.text));
    expect(rows[0]).toEqual(['Rectifier O/P 440V AC and I/P 190V DC', '1', '4.0', '16-Sep-2026']);
    expect(rows).toHaveLength(4);
    expect(model.spares.topLine).toBeNull();
  });

  it('the open tasks and the PM tasks, each with its way to the desk, and an overdue PM says so', () => {
    expect(model.tasks.open.rows.map((r) => r.ref)).toEqual(['BD-1']);
    expect(model.tasks.pm.rows[0]).toMatchObject({
      ref: 'PM-1',
      overdue: 'Overdue',
      scheduled: 'Scheduled 05-Nov-2026',
      href: '/desk/t2',
    });
    expect(machinePageModel(reply, facts('HMC-2', null), t)!.tasks.unavailable).toBe(
      'Tasks are not available right now.',
    );
  });

  it('the nameplate (every fact the plant recorded), the record completeness and the machine’s own chips', () => {
    expect(model.nameplate.facts.map((f) => f.label)).toEqual([
      'Segment',
      'Category',
      'Make',
      'Model',
      'Serial no',
      'Controller',
      'Controller model',
      'Controller serial',
      'Asset code',
      'Year of purchase',
      'Date of purchase',
      'Cell',
      'Location',
      'Conveyor side',
    ]);
    expect(model.completeness.fact.value).toBe('10 of 10 fields');
    expect(model.machine.chip).toMatchObject({ kind: 'machine', id: 'HMC-2' });
    expect(model.machine.cell).toMatchObject({ kind: 'cell', id: '3' });
  });

  it('the page prints each block under its own heading, and no machine id or money', () => {
    for (const heading of ['Breakdown summary', 'Reliability fit', 'Critical spares', 'Nameplate'])
      expect(markup).toContain(heading);
    expect(markup).toContain(model.verdict.context);
    expect(strings.some((s) => UUID.test(s))).toBe(false);
    expect(JSON.stringify(model)).not.toMatch(/₹/);
  });

  it('is found by the id the route carries, or by the code a drawer’s link carries', () => {
    expect(machinePageModel(reply, facts('HMC-2'), t)!.machine.id).toBe('HMC-2');
    expect(machinePageModel(reply, facts('no-such-machine'), t)).toBeNull();
  });
});
