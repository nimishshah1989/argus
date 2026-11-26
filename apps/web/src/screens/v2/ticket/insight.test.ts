// @vitest-environment node
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import type { Me } from '../../../api.js';
import { actionSpecs, actorFrom, crewFrom } from '../../../components/actionSpecs.js';
import { realT } from '../printed-page/test-support.js';
import { DETAIL, fixtureInput, SUPERVISOR } from './fixture.js';
import { ticketModel } from './adapter.js';
import { allowedActions, reportState } from './model.js';

/**
 * Ticket 771 (S29, ADR 0045 T5). Critical tests only (ADR 0034): the minutes, the people and who may do what. The
 * fixture is a stopped VC-17 reported 78 min ago, worked by Tech A (lead, 47 min) and Tech B (support, 37 min).
 */
const model = () => ticketModel(fixtureInput(), realT);
const BOARD: Me = { ...SUPERVISOR, id: 'u9', role: 'board' };

describe('ticket figures (Minutes card and facts)', () => {
  it('draws live downtime, work time and waiting, each against the time since reported', () => {
    const figures = model().minutes!.figures;
    expect(figures.map((f) => [f.id, f.minutes, f.value])).toEqual([
      ['downtime', 78, '1 h 18 min'],
      ['workTime', 47, '47 min'],
      ['waiting', 0, '0 min'],
    ]);
    for (const figure of figures) expect(figure.yardstick, figure.id).toContain('1 h 18 min');
  });

  it('says "so far" once, on the Machine downtime fact, never on a figure (e2e /so far$/ matches once)', () => {
    const m = model();
    expect(m.facts.find((f) => f.label === 'Machine downtime')?.value).toBe('1 h 18 min so far');
    expect(m.facts.filter((f) => f.value.endsWith('so far'))).toHaveLength(1);
    expect(m.minutes!.figures.filter((f) => f.value.endsWith('so far'))).toEqual([]);
  });

  it('lists the lead first, each with their own minutes, and names the top worker in the takeaway', () => {
    const m = model();
    expect(m.people.rows.map((r) => [r.key, r.name, r.minutes])).toEqual([
      ['p2', 'Tech A', 47],
      ['p3', 'Tech B', 37],
    ]);
    const line = m.takeaways['ticket.people']!;
    expect(line.outlier).toBe('p2');
    expect(line.text).toContain('Tech A');
  });

  it('opens the Minutes card with a line that carries the downtime figure', () => {
    expect(model().takeaways['ticket.minutes']!.text).toContain('1 h 18 min');
  });

  it("weighs the downtime against the machine's average, or says it has no history to compare", () => {
    const withAverage = (machineAverage: { downtimeMin: number; breakdowns: number } | null) => {
      const input = fixtureInput();
      return ticketModel({ ...input, detail: { ...input.detail, machineAverage } }, realT)
        .takeaways['ticket.minutes']!;
    };
    const over = withAverage({ downtimeMin: 40, breakdowns: 6 });
    expect(over.text).toContain('38 min over its 40 min average');
    expect(over.tone).toBe('loss');
    const under = withAverage({ downtimeMin: 120, breakdowns: 6 });
    expect(under.text).toContain('42 min under its 2 h 0 min average');
    expect(under.tone).toBe('neutral');
    const none = withAverage(null);
    expect(none.text).toContain('no earlier breakdown to compare with');
    expect(none.text).not.toMatch(/average/);
  });

  it('keeps every event in the history, oldest first, and the newest acknowledge as "Acknowledged by"', () => {
    const m = model();
    expect(m.history.rows.map((r) => r.key)).toEqual([1, 2, 3, 4]);
    expect(m.acknowledgedBy).toContain('Tech A');
  });
});

describe('who may do what (domain availableActions through actionSpecs)', () => {
  it('gives a supervisor exactly v1’s bar, in v1’s order', () => {
    const { ticket, people } = DETAIL;
    const v1 = actionSpecs(ticket, crewFrom(people), actorFrom(SUPERVISOR)!);
    expect(v1.length).toBeGreaterThan(0);
    expect(allowedActions(DETAIL, SUPERVISOR)).toEqual(v1);
  });

  it('gives the board, a login still loading and a closed ticket no actions', () => {
    expect(allowedActions(DETAIL, BOARD)).toEqual([]);
    expect(allowedActions(DETAIL, undefined)).toEqual([]);
    const closed = fixtureInput({ status: 'closed', closedAt: DETAIL.ticket.startedAt }).detail;
    expect(allowedActions(closed, SUPERVISOR)).toEqual([]);
  });
});

describe('report state of a closed ticket', () => {
  it('needs a report when closed without one; has one when closed with one; none while live', () => {
    const closed = (closeKind: 'report' | 'no_report') =>
      fixtureInput({ status: 'closed', closeKind }).detail;
    expect(reportState(closed('no_report'))).toBe('needs');
    expect(reportState(closed('report'))).toBe('with');
    expect(reportState(DETAIL)).toBeNull();
  });
});
