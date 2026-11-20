// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { describe, expect, it } from 'vitest';
import { NUDGE_RULES, NUDGE_SEVERITIES, type ActionCenterBoardReply } from '@uptimo/shared';
import '../../../i18n/index.js';
import { UUID } from '../figures/real-reply.js';
import { actionCenterModel, type BoardFacts } from './adapter.js';
import type { ActionCenterActions, ActionCenterModel } from './model.js';
import { nudgeView, type NudgeAsk } from './scope.js';
import { PEOPLE, recordedBoard, rekeyed } from './test-board.js';
import { ActionCenterView } from './View.js';

const t = (key: string, values?: Record<string, string | number>) =>
  i18n.t(key, { ...values }) as string;
const BOARD = recordedBoard();
const CODES = [...new Set(BOARD.nudges.flatMap((n) => n.machines))];
const same = {
  machines: CODES.map((code) => ({ id: code, code, category: null })),
  people: PEOPLE,
};
const facts = (board: ActionCenterBoardReply = BOARD): BoardFacts => ({
  board,
  ...same,
  timeZone: 'Asia/Kolkata',
});
const model = actionCenterModel(facts(), t);
const nav = [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }];

const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
const render = (
  m: ActionCenterModel,
  url = '/analytics/today/action-center',
  acts: ActionCenterActions = {},
) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [url] },
      createElement(ActionCenterView, { model: m, nav, title: 'Action Center', ...acts }),
    ),
  );

/** Every string a model prints, apart from the engine's own key kept to send a write back. */
function printed(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') found.push(value);
  else if (Array.isArray(value)) value.forEach((v) => printed(v, found));
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) if (k !== 'writeKey') printed(v, found);
  return found;
}

describe('the Action Center from the engine’s board', () => {
  it('pins the four priority counts and the four tab counts, and each equals the rows it shows', () => {
    expect(model.kpis.map((k) => [k.id, k.value])).toEqual([
      ['high', '5'],
      ['med', '26'],
      ['low', '2'],
      ['info', '0'],
    ]);
    expect(model.tabs.map((tab) => [tab.key, tab.count])).toEqual([
      ['open', 33],
      ['ack', 1],
      ['snoozed', 1],
      ['resolved', 1],
    ]);
    for (const kpi of model.kpis)
      expect(model.nudges.filter((n) => n.status === 'open' && n.severity === kpi.id).length).toBe(
        Number(kpi.value),
      );
    for (const tab of model.tabs)
      expect(model.nudges.filter((n) => n.status === tab.key).length).toBe(tab.count);
    expect(model.kpis.some((k) => k.drill)).toBe(false);
  });

  it('offers all 16 kinds in the engine’s order and prints every one of the 36 nudges with the engine’s sentence', () => {
    expect(model.types.map((x) => x.key)).toEqual([...NUDGE_RULES]);
    expect(model.types.map((x) => x.label)).toContain('Good news');
    expect(model.nudges.map((n) => n.titleText)).toEqual(BOARD.nudges.map((n) => n.title));
    expect(model.nudges[0]).toMatchObject({
      rule: 'freq',
      severity: 'high',
      ruleLabel: 'Frequent breakdowns',
      entries: '12 entries',
      latest: { shown: '07-Nov-2026' },
      latestText: 'Latest entry 07-Nov-2026',
      actions: ['ack', 'snooze', 'resolved'],
    });
    expect(model.nudges[0]!.machines.map((c) => c.label)).toEqual(['HMC-2']);
  });

  it('reads the acknowledged, snoozed and resolved nudges: owner as a person, due, note, until, and only Reopen', () => {
    const by = (rule: string, status: string) =>
      model.nudges.find((n) => n.status === status && n.writeKey.startsWith(rule))!;
    const acked = by('freq|TC-3', 'ack');
    expect(acked.actions).toEqual(['reopen']);
    expect(acked.statusLabel).toBe('Acknowledged');
    expect(acked.ack).toMatchObject({ due: 'Due 20-Nov-2026', note: 'Note: Check the bearing' });
    expect(acked.ack!.owner[0]).toMatchObject({
      text: 'Asha',
      entity: { kind: 'person', id: 'asha' },
    });
    const snoozed = by('rise|VC-41', 'snoozed');
    expect(snoozed.statusLabel).toBe('Snoozed until 18-Nov-2026');
    expect(snoozed.ack).toMatchObject({ owner: [], due: '', note: '', until: '18-Nov-2026' });
    expect(by('mttr|S-2', 'resolved').actions).toEqual(['reopen']);
  });

  it('marks a nudge that came back after it was closed, and one outside production data', () => {
    const board: ActionCenterBoardReply = {
      ...BOARD,
      nudges: BOARD.nudges.map((n, at) => ({ ...n, reopened: at === 1, excluded: at === 3 })),
    };
    const m = actionCenterModel(facts(board), t);
    const page = text(render(m));
    expect(page).toContain('New activity since it was closed');
    expect(page).toContain('Not in production data');
  });

  it('gives a good-news nudge no button at all, and says Good news', () => {
    const good = {
      ...BOARD.nudges[0]!,
      key: 'good|hrs',
      rule: 'good' as const,
      sev: 'info' as const,
      title: 'Downtime this week is 52% below the recent weekly average',
      machines: [],
    };
    const m = actionCenterModel(
      facts({
        ...BOARD,
        nudges: [good],
        counts: { open: 1, ack: 0, snoozed: 0, resolved: 0 },
        bySeverity: { high: 0, med: 0, low: 0, info: 1 },
      }),
      t,
    );
    expect(m.nudges[0]).toMatchObject({ actions: [], severityLabel: 'Good news' });
    expect(m.kpis[3]).toMatchObject({ label: 'Good news', value: '1' });
  });

  it('prints the engine’s 8 risk rows with the machine as a chip and the model beside it', () => {
    expect(model.risk).toHaveLength(8);
    expect(model.risk[0]).toMatchObject({
      machine: { kind: 'machine', id: 'HMC-2', label: 'HMC-2' },
      model: 'FMH 500',
      score: { shown: '7', value: 7 },
      why: 'Frequent breakdowns Recurring fault Ageing machines',
    });
  });

  it('carries no money: no rupee anywhere on the page', () => {
    expect(printed(model).join(' ')).not.toMatch(/₹|lakh|crore/i);
    expect(render(model)).not.toMatch(/₹/);
  });

  it('opens with the answer: the engine’s counts in v1’s words, then the machine that ranks first', () => {
    expect(model.verdict.headline[0]!.text).toBe(
      '5 high-priority and 26 medium nudges need attention',
    );
    expect(model.verdict.context).toContain('11-Nov-2026');
    const first = model.verdict.why[0]!;
    expect(first[0]).toMatchObject({ entity: { kind: 'machine', id: 'HMC-2' } });
    expect(first[1]!.text).toContain('score of 7');
  });

  it('gives a plant with no nudge its counts as zeros, not a missing card', () => {
    const empty: ActionCenterBoardReply = {
      ...BOARD,
      nudges: [],
      risk: [],
      counts: { open: 0, ack: 0, snoozed: 0, resolved: 0 },
      bySeverity: { high: 0, med: 0, low: 0, info: 0 },
    };
    const m = actionCenterModel(facts(empty), t);
    expect(m.kpis.map((k) => k.value)).toEqual(['0', '0', '0', '0']);
    expect(m.kpis.every((k) => k.meaning === 'Nothing open')).toBe(true);
    expect(m.verdict.headline[0]!.text).toBe('Nothing needs attention with the current limits.');
    const page = text(render(m));
    expect(page).toContain('Nothing needs attention with the current limits.');
    expect(page).toContain('High priority');
  });

  it('chooses an owner only among the active people', () => {
    expect(model.people).toEqual(['Asha', 'Ravi']);
  });
});

describe('a real plant sends database ids; none reaches the screen', () => {
  const real = rekeyed(BOARD);
  const m = actionCenterModel({ ...facts(real.board), machines: real.machines }, t);

  it('really re-keyed the plant: ids are UUIDs unlike the codes, in the key, the title and the risk rows', () => {
    expect(real.board.nudges[0]!.machines[0]).toMatch(UUID);
    expect(real.board.nudges[0]!.title).toMatch(UUID);
    expect(real.board.nudges[0]!.key).toMatch(UUID);
    expect(real.board.risk[0]!.machine).toMatch(UUID);
    expect(real.board.nudges.find((n) => n.rule === 'long')!.key).toMatch(UUID);
  });

  it('prints codes in every sentence, chip, label and address, and keeps the engine key only to send a write', () => {
    expect(printed(m).filter((s) => UUID.test(s))).toEqual([]);
    expect(m.nudges.map((n) => n.titleText)).toEqual(BOARD.nudges.map((n) => n.title));
    expect(m.nudges.find((n) => n.rule === 'freq')!.writeKey).toMatch(UUID);
    expect(m.nudges[0]!.id).toBe('freq~HMC-2');
    expect(m.nudges.find((n) => n.rule === 'long')!.id).toMatch(/^long~[0-9a-f]{8}$/);
    expect(new Set(m.nudges.map((n) => n.id)).size).toBe(36);
    expect(m.risk[0]!.machine).toMatchObject({ id: 'HMC-2', label: 'HMC-2' });
  });

  it('draws the page, the drawer and every link without an id', () => {
    const id = m.nudges[0]!.id;
    const html = render(m, `/analytics/today/action-center?drawer=decision:${id}`);
    expect(html).not.toMatch(UUID);
    expect(text(html)).toContain('HMC-2 has broken down 12 times in 30 days');
  });

  it('shows a dash for a machine the plant does not list, never its id', () => {
    const lonely = { ...real, machines: real.machines.slice(1) };
    const dashed = actionCenterModel({ ...facts(real.board), machines: lonely.machines }, t);
    expect(printed(dashed).filter((s) => UUID.test(s))).toEqual([]);
    expect(dashed.nudges[0]!.titleText).toBe('— has broken down 12 times in 30 days');
    expect(dashed.nudges[0]!.machines).toEqual([]);
  });
});

describe('the page', () => {
  it('lists the first 10 of the open nudges in the engine’s order, with its search, priority chips and type', () => {
    const page = text(render(model));
    expect(page).toContain('1–10 of 33');
    expect(page).toContain('Open 33');
    expect(page).toContain('Acknowledged 1');
    expect(page).toContain('Snoozed 1');
    expect(page).toContain('Resolved 1');
    expect(page).toContain('All priorities');
    expect(page).toContain('All types');
    expect(page).toContain('Machines needing attention');
    expect(render(model)).toContain('Search machine or text');
    expect(page.indexOf('HMC-2 has broken down')).toBeLessThan(
      page.indexOf('VC-14 has broken down'),
    );
  });

  it('opens a nudge in the drawer with its buttons, and says not found for one the board no longer holds', () => {
    const id = model.nudges[0]!.id;
    const open = text(render(model, `/x?drawer=decision:${id}`));
    for (const word of ['Acknowledge', 'Snooze 7 days', 'Resolved', 'Latest entry', '12']) {
      expect(open).toContain(word);
    }
    const gone = render(model, '/x?drawer=decision:freq~NOPE');
    expect(gone).not.toContain('Snooze 7 days');
  });

  it('offers Reopen, and not the three writes, on a stored nudge', () => {
    const acked = model.nudges.find((n) => n.status === 'ack')!;
    const open = text(render(model, `/x?drawer=decision:${acked.id}`));
    expect(open).toContain('Reopen');
    expect(open).not.toContain('Snooze 7 days');
    expect(open).toContain('Due 20-Nov-2026');
    expect(open).toContain('Note: Check the bearing');
  });
});

const ASK: NudgeAsk = { status: 'open', type: '', query: '', priority: '', page: 1 };
const rowsOf = (ask: Partial<NudgeAsk>) => {
  const all: string[] = [];
  const first = nudgeView(model.nudges, { ...ASK, ...ask });
  for (let page = 1; page <= first.page + Math.ceil(first.total / 10); page += 1)
    all.push(...nudgeView(model.nudges, { ...ASK, ...ask, page }).rows.map((r) => r.id));
  return [...new Set(all)];
};

describe('the priority chips count the rows the list shows', () => {
  const asks: Partial<NudgeAsk>[] = [
    {},
    { type: 'freq' },
    { type: 'mttr' },
    { query: 'hmc-2' },
    { status: 'ack' },
    { status: 'snoozed' },
    { status: 'resolved' },
    { type: 'recur', query: 'ATC' },
  ];

  it('each chip says how many rows it opens, under any tab, type and search', () => {
    for (const ask of asks) {
      const view = nudgeView(model.nudges, { ...ASK, ...ask });
      let sum = 0;
      for (const priority of NUDGE_SEVERITIES) {
        const shown = nudgeView(model.nudges, { ...ASK, ...ask, priority });
        expect(shown.total, JSON.stringify([ask, priority])).toBe(view.counts[priority]);
        sum += shown.total;
      }
      expect(sum).toBe(view.counts.all);
      expect(nudgeView(model.nudges, { ...ASK, ...ask }).total).toBe(view.counts.all);
    }
  });

  it('on the real board: the open tab is 5, 26, 2, 0; Acknowledged has one high; a type or a search narrows every chip', () => {
    const open = nudgeView(model.nudges, ASK).counts;
    expect([open.high, open.med, open.low, open.info, open.all]).toEqual([5, 26, 2, 0, 33]);
    expect(nudgeView(model.nudges, { ...ASK, status: 'ack' }).counts).toMatchObject({
      all: 1,
      high: 1,
      med: 0,
    });
    const freq = nudgeView(model.nudges, { ...ASK, type: 'freq' }).counts;
    expect(freq.all).toBe(
      model.nudges.filter((n) => n.status === 'open' && n.rule === 'freq').length,
    );
    expect(freq.all).toBeLessThan(open.all);
    const found = nudgeView(model.nudges, { ...ASK, query: 'hmc-2' });
    expect(found.counts.all).toBe(
      model.nudges.filter((n) => n.status === 'open' && n.text.toLowerCase().includes('hmc-2'))
        .length,
    );
  });

  it('keeps the engine’s order under a priority chip, beyond the first page', () => {
    const med = model.nudges
      .filter((n) => n.status === 'open' && n.severity === 'med')
      .map((n) => n.id);
    expect(med).toHaveLength(26);
    const pages = [1, 2, 3].map((page) =>
      nudgeView(model.nudges, { ...ASK, priority: 'med', page }).rows.map((r) => r.id),
    );
    expect(pages.map((p) => p.length)).toEqual([10, 10, 6]);
    expect(pages.flat()).toEqual(med);
    expect(rowsOf({ priority: 'med' })).toEqual(med);
  });

  it('sorts only when a column is asked for, and a sort reorders the whole list, not the page', () => {
    const engine = nudgeView(model.nudges, ASK).rows.map((r) => r.id);
    expect(engine).toEqual(
      model.nudges
        .filter((n) => n.status === 'open')
        .slice(0, 10)
        .map((n) => n.id),
    );
    const byEntries = nudgeView(model.nudges, {
      ...ASK,
      sort: { key: 'entries', dir: 'desc' },
    }).rows;
    expect(byEntries[0]!.count).toBe(
      Math.max(...model.nudges.filter((n) => n.status === 'open').map((n) => n.count)),
    );
  });

  it('prints the count on each chip in the page', () => {
    const page = text(render(model));
    for (const label of [
      'All priorities 33',
      'High priority 5',
      'Medium 26',
      'Low 2',
      'Good news 0',
    ])
      expect(page).toContain(label);
  });
});

describe('a write that failed is shown on its own nudge only', () => {
  const [a, b] = model.nudges;
  const open = (id: string, acts: ActionCenterActions) =>
    text(render(model, `/x?drawer=decision:${id}`, acts));

  it('shows the alert in the drawer of the nudge whose write failed', () => {
    expect(open(a!.id, { failedKey: a!.writeKey })).toContain('The nudge could not be saved');
  });

  it('does not show it in another nudge’s drawer, nor after the failure is cleared', () => {
    expect(open(b!.id, { failedKey: a!.writeKey })).not.toContain('could not be saved');
    expect(open(a!.id, { failedKey: null })).not.toContain('could not be saved');
  });

  it('shows it on the page when no nudge is open', () => {
    expect(text(render(model, '/x', { failedKey: a!.writeKey }))).toContain(
      'The nudge could not be saved',
    );
  });
});
