import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { UUID } from '../figures/real-reply.js';
import { answerKey, keyPage, realT, testT } from '../printed-page/test-support.js';
import { whyWhyModel, FIGURE } from './adapter.js';
import type { WhyWhyActions } from './model.js';
import { WhyWhyView } from './View.js';

const reply = answerKey('a6-why-why', 'a6-why-why', 41);
const model = whyWhyModel(reply, testT)!;
const table = keyPage(reply).tables[0]!;
const says = (point: { text: string }[]) => point.map((s) => s.text).join('');

describe('Why-Why from the engine reply', () => {
  it('keeps every candidate in the engine order, with its own status word', () => {
    expect(model.rows).toHaveLength(table.rows.length);
    expect(
      model.rows.map((r) => [r.machine.label, r.problem, r.down.shown, r.status.text]),
    ).toEqual(table.rows.map((r) => [r[0], r[2], r[3], r[4]]));
  });

  it('reads the date as DD-MMM-YYYY and sorts it by day', () => {
    expect(model.rows[0]!.date).toEqual({
      shown: '13-Jun-2026',
      value: 20260613,
      printed: '13-06-2026',
    });
  });

  it('does not print the platform action cell: the screen draws its own Start and View', () => {
    expect(JSON.stringify(model.rows)).not.toMatch(/Start Why-Why|View \/ Edit/);
  });

  it('says how many candidates there are and how many are done, and names the longest', () => {
    expect(says(model.verdict.headline)).toBe(
      '24 breakdowns ran past the Why-Why limit: 0 have a Why-Why, 24 are waiting.',
    );
    expect(model.verdict.why.map(says)).toEqual([
      'The longest was TMC-2 on 13-Jun-2026, 238.58 hrs down. geometry problem',
    ]);
  });

  it('counts a saved Why-Why from the engine status', () => {
    const value = JSON.parse(JSON.stringify(reply.figures[0]!.value));
    value.pages[0].tables[0].rows[1][4] = 'Completed';
    const done = whyWhyModel({ ...reply, figures: [{ ...reply.figures[0]!, value }] }, testT)!;
    expect(done.rows[1]!.status.done).toBe(true);
    expect(says(done.verdict.headline)).toMatch(/1 have a Why-Why, 23 are waiting/);
  });

  it('is empty when the engine has no candidates', () => {
    const none = { ...reply, figures: [{ ...reply.figures[0]!, status: 'not_computed' as const }] };
    expect(whyWhyModel(none, testT)).toBeNull();
  });
});

/** The same page with a ticket id printed beside each row, as the engine does: worst row first, ids NOT in sorted order. */
function withTickets(ids: string[]) {
  const value = JSON.parse(JSON.stringify(reply.figures[0]!.value));
  value.pages[0].tables[0].rowTicketIds = ids;
  const drill = { type: 'ticket' as const, ids: [...ids].sort() };
  return { ...reply, figures: [{ ...reply.figures[0]!, value, drill }] };
}
const TICKETS = table.rows.map(
  (_, at) => `00000000-0000-4000-8000-${String(900 - at).padStart(12, '0')}`,
);
const nav = [{ id: 'p', label: 'Problems', icon: 'machines' as const, href: '/a', current: true }];
const actions = (write: boolean): WhyWhyActions => ({
  write,
  author: 'Author: Test',
  failure: null,
  open: null,
  saving: false,
  saved: false,
  onStart: () => {},
  onSave: () => {},
  onPdf: () => {},
  onCancel: () => {},
});
const draw = (m: NonNullable<typeof model>, a?: WhyWhyActions) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      {},
      createElement(WhyWhyView, { model: m, nav, title: 'Why-Why', actions: a }),
    ),
  );

describe('Start and View act on each row’s own ticket', () => {
  const ticketed = whyWhyModel(withTickets(TICKETS), realT)!;

  it('ties a row to the id printed beside it, whatever order the sorted drill lists the tickets in', () => {
    expect(ticketed.rows.map((r) => r.ticketId)).toEqual(TICKETS);
    expect(TICKETS).not.toEqual([...TICKETS].sort());
  });

  it('names no ticket for a row the engine named none for, so that row offers no action', () => {
    const partial = whyWhyModel(withTickets(TICKETS.map((id, at) => (at === 0 ? id : ''))), realT)!;
    expect(partial.rows[0]!.ticketId).toBe(TICKETS[0]);
    expect(partial.rows[1]!.ticketId).toBeNull();
    expect(partial.rows[2]!.ticketId).toBeNull();
    expect(whyWhyModel(reply, realT)!.rows.every((r) => r.ticketId === null)).toBe(true);
  });

  it('shows Start on every waiting row of the page a role that may save opens, and no ticket id anywhere on it', () => {
    const markup = draw(ticketed, actions(true));
    expect(markup.match(/Start Why-Why/g)).toHaveLength(10);
    expect(markup).toContain('Action');
    expect(markup).not.toMatch(UUID);
  });

  it('shows View or edit on a row that is completed', () => {
    const value = JSON.parse(JSON.stringify(reply.figures[0]!.value));
    value.pages[0].tables[0].rows[0][4] = 'Completed';
    value.pages[0].tables[0].rowTicketIds = TICKETS;
    const done = whyWhyModel({ ...reply, figures: [{ ...reply.figures[0]!, value }] }, realT)!;
    expect(draw(done, actions(true))).toContain('View or edit');
  });

  it('offers no action to a role that may not save, and says so', () => {
    const markup = draw(ticketed, actions(false));
    expect(markup).not.toContain('Start Why-Why');
    expect(markup).toContain('Only a supervisor, head, plant head or admin may save a Why-Why');
  });

  it('offers no action and no refusal on the read-only page, before the login is known', () => {
    const markup = draw(ticketed);
    expect(markup).not.toContain('Start Why-Why');
    expect(markup).not.toContain('Only a supervisor');
  });

  it('opens the form with the five whys and the required conclusion for the open row', () => {
    const markup = draw(ticketed, {
      ...actions(true),
      open: { rowId: '0', machine: 'TMC-2', date: '13-Jun-2026', completed: false, record: null },
    });
    for (const label of ['Why 1', 'Why 2', 'Why 3', 'Why 4', 'Why 5', 'Conclusion (required)'])
      expect(markup).toContain(label);
    expect(markup).toContain('Why-Why form');
    expect(markup).toContain('TMC-2 · 13-Jun-2026');
    expect(markup).not.toContain('Download PDF');
  });

  it('offers the PDF once a record is saved', () => {
    const markup = draw(ticketed, {
      ...actions(true),
      open: { rowId: '0', machine: 'TMC-2', date: '13-Jun-2026', completed: true, record: null },
    });
    expect(markup).toContain('Download PDF');
  });

  it('keeps the engine’s own printed date for the PDF’s file name', () => {
    expect(ticketed.rows[0]!.date.printed).toBe('13-06-2026');
  });

  it('opens the rows behind the whole page from one page control, never from a count', () => {
    expect(ticketed.drill).toMatchObject({ figure: FIGURE });
    expect(draw(ticketed)).toContain('Show the rows behind');
  });
});
