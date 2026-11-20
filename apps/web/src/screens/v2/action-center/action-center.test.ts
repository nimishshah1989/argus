// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import i18n from 'i18next';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';
import '../../../i18n/index.js';
import { refuseUnlessAnalytics } from '../figures/refuse.js';
import { UUID, printed, realBoard } from '../figures/real-reply.js';
import { actionCenterModel } from './adapter.js';
import { ActionCenterView } from './View.js';

/**
 * The completeness test: every item v1's Action Center showed is printed by the v2 screen, from the board the real
 * engine builds over the frozen 11 November plant (not rows written for the test).
 */
const first = realBoard();
const [acked, snoozed, resolved] = first.nudges.filter(
  (n) => n.sev !== 'info' && n.status === 'open',
);
const AT = '2026-11-11T08:00:00.000Z';
/** The board after a head acknowledged, snoozed and resolved one nudge each: what the server answers a write. */
const board = realBoard({
  [acked!.key]: {
    status: 'ack',
    owner: 'Asha',
    due: '2026-11-20',
    note: 'Check the bearing',
    at: AT,
  },
  [snoozed!.key]: {
    status: 'snooze',
    owner: '',
    due: '',
    note: '',
    at: AT,
    until: '2026-11-18T08:00:00.000Z',
  },
  [resolved!.key]: { status: 'done', owner: 'Hari', due: '', note: 'Sealed', at: AT },
});
const t = (key: string, values?: Record<string, string | number>) =>
  i18n.t(key, { ...values }) as string;
const model = actionCenterModel(
  board,
  {
    machines: ENGINE_DATA.machines.map((m) => ({ id: m.id, code: m.id, category: m.category })),
    people: [{ id: 'p1', name: 'Asha', active: true }],
    timeZone: 'Asia/Kolkata',
  },
  t,
);
const nav = [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }];
const markup = renderToStaticMarkup(
  createElement(
    MemoryRouter,
    { initialEntries: ['/analytics/today/action-center'] },
    createElement(ActionCenterView, { model, nav, title: 'Action Center' }),
  ),
);
const strings = printed(model);

describe('the v2 Action Center prints everything v1 showed', () => {
  it('one card for every nudge on the board, with its title, type, entries and evidence', () => {
    expect(board.nudges.length).toBeGreaterThan(30);
    expect(model.nudges).toHaveLength(board.nudges.length);
    for (const [at, nudge] of board.nudges.entries()) {
      const card = model.nudges[at]!;
      expect(card.key).toBe(nudge.key);
      expect(card.title).toBe(nudge.title);
      expect(strings).toContain(t(`analytics.actionCenter.rule.${nudge.rule}`));
      expect(strings).toContain(t('analytics.actionCenter.entries', { count: nudge.entries }));
      if (nudge.ev !== null) expect(card.evidence).toMatch(/\d{2}-[A-Z][a-z]{2}-\d{4}$/);
      expect(card.machines.map((m) => m.id)).toEqual(nudge.machines);
    }
  });

  it('the four priority counts, the four status tabs and the sixteen types', () => {
    expect(model.tiles.map((tile) => [tile.id, tile.value])).toEqual(
      (['high', 'med', 'low', 'info'] as const).map((key) => [key, String(board.bySeverity[key])]),
    );
    expect(model.tabs.map((tab) => [tab.status, tab.count])).toEqual(
      (['open', 'ack', 'snoozed', 'resolved'] as const).map((key) => [key, board.counts[key]]),
    );
    expect(model.types).toHaveLength(16);
    expect(model.types.map((type) => type.label)).toEqual(Object.values(board.types));
  });

  it('the machines needing attention, with their score and the rules that fired', () => {
    expect(model.risk).toHaveLength(board.risk.length);
    for (const [at, row] of board.risk.entries()) {
      expect(model.risk[at]!.score.shown).toBe(String(row.score));
      expect(model.risk[at]!.why).toBe(row.why);
      expect(model.risk[at]!.model).toBe(row.model);
    }
    expect(markup).toContain(board.risk[0]!.why);
  });

  it('what was done to a stored nudge: the status, the owner, the due day and the note', () => {
    const card = (key: string) => model.nudges.find((c) => c.key === key)!;
    expect(card(acked!.key).status).toBe('ack');
    expect(card(acked!.key).saved).toEqual([
      'Acknowledged',
      'Owner: Asha',
      'Due 20-Nov-2026',
      'Note: Check the bearing',
    ]);
    expect(card(snoozed!.key).saved).toEqual(['Snoozed until 18-Nov-2026']);
    expect(card(resolved!.key).saved).toEqual(['Resolved', 'Owner: Hari', 'Note: Sealed']);
    for (const key of [acked!.key, snoozed!.key, resolved!.key])
      expect(card(key).actions).toEqual(['reopen']);
  });

  it('good news has no button; an open nudge takes acknowledge, snooze and resolve', () => {
    const open = model.nudges.filter((c) => c.status === 'open' && c.severity !== 'info');
    expect(open.length).toBeGreaterThan(0);
    for (const card of open) expect(card.actions).toEqual(['ack', 'snooze', 'resolved']);
    for (const card of model.nudges.filter((c) => c.severity === 'info'))
      expect(card.actions).toEqual([]);
  });

  it('the page opens on the open tab with the tiles, the table and the filters', () => {
    expect(markup).toContain(model.nudges.find((c) => c.status === 'open')!.title);
    expect(markup).toContain('aria-label="Action Center status"');
    expect(markup).toContain(t('analytics.actionCenter.priorityLabel'));
    expect(markup).toContain(t('analytics.actionCenter.typeLabel'));
    expect(markup).toContain(t('analytics.actionCenter.risk.title'));
  });

  it('no machine id, no money', () => {
    expect(strings.some((s) => UUID.test(s))).toBe(false);
    expect(JSON.stringify(model)).not.toMatch(/₹|spares-spend/);
  });

  it('refuses a login that may not read the analytics, as the server would', () => {
    expect(() => refuseUnlessAnalytics('operator')).toThrow();
    expect(() => refuseUnlessAnalytics('head')).not.toThrow();
  });
});
