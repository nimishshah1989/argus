import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type {
  ActionCenterBoardReply,
  BoardNudgeReply,
  NudgeAckReply,
  NudgeStatus,
} from '@uptimo/shared';
import {
  actionCenterView,
  bannerOf,
  dmy,
  filterCards,
  plantDayOf,
  severityGroups,
} from './action-center.js';

/**
 * 44d: the Action Center's mapping, pinned against the frozen 11 November key and one board literal. The key
 * supplies the 36 nudges, the 16 type labels and the 8 risk rows; the literal adds the statuses the key never
 * has (one acked, one snoozed, one resolved) so the four tabs and the Reopen-only cards are pinned too.
 */

interface KeyNudge {
  key: string;
  rule: string;
  sev: string;
  title: string;
  machines: string[];
  entries: number;
}

interface KeyTable {
  title: string;
  header: string[];
  rows: string[][];
  rowCount: number;
}

interface KeyFile {
  asOf: string;
  pages: { title: string; kpis: unknown[]; tables: KeyTable[]; charts: unknown[] }[];
  extra: {
    types: Record<string, string>;
    thresholds: Record<string, number>;
    acks: Record<string, unknown>;
    nudges: KeyNudge[];
  };
}

function keyOf(name: string): KeyFile {
  return JSON.parse(
    readFileSync(
      new URL(`../../../../../fixtures/answer-key/${name}.json`, import.meta.url),
      'utf8',
    ),
  ) as KeyFile;
}

const KEY = keyOf('action-center');
const ACKED = 8;
const SNOOZED = 9;
const RESOLVED = 10;
const STATUS: Record<number, NudgeStatus> = {
  [ACKED]: 'ack',
  [SNOOZED]: 'snoozed',
  [RESOLVED]: 'resolved',
};
const AT = '2026-11-11T08:00:00.000Z';
const ACK_RECORD: NudgeAckReply = {
  status: 'ack',
  owner: 'Asha',
  due: '2026-11-20',
  note: 'Check the bearing',
  at: AT,
};
const SNOOZE_RECORD: NudgeAckReply = {
  status: 'snooze',
  owner: '',
  due: '',
  note: '',
  at: AT,
  until: '2026-11-18T08:00:00.000Z',
};
const DONE_RECORD: NudgeAckReply = {
  status: 'done',
  owner: 'Hari',
  due: '',
  note: 'Sealed',
  at: AT,
};

function boardNudges(): BoardNudgeReply[] {
  return KEY.extra.nudges.map((nudge, index) => ({
    key: nudge.key,
    rule: nudge.rule,
    sev: nudge.sev,
    title: nudge.title,
    machines: nudge.machines,
    entries: nudge.entries,
    status: STATUS[index] ?? 'open',
    reopened: index === 1,
    ev: '2026-11-10',
    excluded: index === 2,
    ack:
      index === ACKED
        ? ACK_RECORD
        : index === SNOOZED
          ? SNOOZE_RECORD
          : index === RESOLVED
            ? DONE_RECORD
            : null,
  })) as BoardNudgeReply[];
}

/** The key's machine cell split back into the board's machine and model (the id is the first word). */
function riskRows(): ActionCenterBoardReply['risk'] {
  return KEY.pages[0]!.tables[0]!.rows.map((row) => {
    const cell = row[0] ?? '';
    const space = cell.indexOf(' ');
    return {
      machine: space === -1 ? cell : cell.slice(0, space),
      model: space === -1 ? '' : cell.slice(space + 1),
      score: Number(row[1] ?? 0),
      why: row[2] ?? '',
    };
  });
}

const BOARD: ActionCenterBoardReply = {
  asOf: KEY.asOf,
  snoozeDays: KEY.extra.thresholds.snoozeDays!,
  types: KEY.extra.types as ActionCenterBoardReply['types'],
  nudges: boardNudges(),
  counts: { open: 33, ack: 1, snoozed: 1, resolved: 1 },
  bySeverity: { high: 6, med: 25, low: 2, info: 0 },
  risk: riskRows(),
};

const VIEW = actionCenterView(BOARD, 'Asia/Kolkata');
const OPEN = { status: 'open' as const, severity: '' as const, rule: '' as const, query: '' };

describe('the Action Center view maps the key whole', () => {
  it('pins the four tiles and the four tabs from the key counts', () => {
    expect(VIEW.tiles.map((tile) => [tile.severity, tile.count])).toEqual([
      ['high', 6],
      ['med', 25],
      ['low', 2],
      ['info', 0],
    ]);
    expect(VIEW.tiles.map((tile) => tile.label)).toEqual([
      'analytics.actionCenter.tile.high',
      'analytics.actionCenter.tile.med',
      'analytics.actionCenter.tile.low',
      'analytics.actionCenter.tile.info',
    ]);
    expect(VIEW.tabs.map((tab) => [tab.status, tab.count])).toEqual([
      ['open', 33],
      ['ack', 1],
      ['snoozed', 1],
      ['resolved', 1],
    ]);
    expect(VIEW.tabs.map((tab) => tab.label)).toEqual([
      'analytics.actionCenter.tab.open',
      'analytics.actionCenter.tab.ack',
      'analytics.actionCenter.tab.snoozed',
      'analytics.actionCenter.tab.resolved',
    ]);
    expect(VIEW.asOf).toBe('11-11-2026');
    expect(VIEW.snoozeDays).toBe(7);
  });

  it('offers all 16 types in the key order', () => {
    expect(VIEW.types).toHaveLength(16);
    expect(VIEW.types.map((option) => option.label)).toEqual(Object.values(KEY.extra.types));
  });

  it('prints every one of the 36 cards with the key title, and the first card whole', () => {
    expect(VIEW.cards).toHaveLength(36);
    expect(VIEW.cards.map((card) => card.title)).toEqual(
      KEY.extra.nudges.map((nudge) => nudge.title),
    );
    expect(VIEW.cards[0]).toEqual({
      key: 'freq|HMC-2',
      rule: 'freq',
      severity: 'high',
      type: 'Frequent breakdowns',
      title: 'HMC-2 has broken down 12 times in 30 days',
      machines: [{ id: 'HMC-2', label: 'HMC-2', href: '/analytics/machines/HMC-2' }],
      entries: 12,
      evidence: '10-11-2026',
      excluded: false,
      reopened: false,
      status: 'open',
      ack: null,
      actions: ['ack', 'snooze', 'resolved'],
    });
    expect(VIEW.cards[1]!.reopened).toBe(true);
    expect(VIEW.cards[2]!.excluded).toBe(true);
    for (const card of VIEW.cards)
      for (const machine of card.machines)
        expect(machine.href).toBe(`/analytics/machines/${machine.id}`);
  });

  it('reads the acked, snoozed and resolved cards: the status line and only Reopen', () => {
    const acked = VIEW.cards[ACKED]!;
    expect(acked.status).toBe('ack');
    expect(acked.actions).toEqual(['reopen']);
    expect(acked.ack).toEqual({
      owner: 'Asha',
      due: '20-11-2026',
      note: 'Check the bearing',
      until: '',
    });
    const snoozed = VIEW.cards[SNOOZED]!;
    expect(snoozed.status).toBe('snoozed');
    expect(snoozed.actions).toEqual(['reopen']);
    expect(snoozed.ack?.until).toBe('18-11-2026');
    const resolved = VIEW.cards[RESOLVED]!;
    expect(resolved.status).toBe('resolved');
    expect(resolved.actions).toEqual(['reopen']);
    expect(resolved.ack?.owner).toBe('Hari');
  });

  it('gives a good-news nudge no button at all', () => {
    const good = {
      ...boardNudges()[0]!,
      key: 'good|hrs',
      rule: 'good',
      sev: 'info',
      title: 'Good news',
    };
    const view = actionCenterView(
      {
        ...BOARD,
        nudges: [good as BoardNudgeReply],
        counts: { open: 1, ack: 0, snoozed: 0, resolved: 0 },
      },
      'Asia/Kolkata',
    );
    expect(view.cards[0]!.actions).toEqual([]);
  });

  it('prints the key 8 risk rows, machine and model apart, each a machine link', () => {
    const rows = KEY.pages[0]!.tables[0]!.rows;
    expect(VIEW.risk).toHaveLength(8);
    expect(VIEW.risk.map((row) => row.label)).toEqual(rows.map((row) => row[0]));
    expect(VIEW.risk.map((row) => row.score)).toEqual(rows.map((row) => row[1]));
    expect(VIEW.risk.map((row) => row.why)).toEqual(rows.map((row) => row[2]));
    expect(VIEW.risk[0]).toMatchObject({
      machine: 'HMC-2',
      model: 'FMH 500',
      href: '/analytics/machines/HMC-2',
    });
  });

  it('resolves a machine id to its code without changing the drill', () => {
    const view = actionCenterView(BOARD, 'Asia/Kolkata', (id) => (id === 'HMC-2' ? 'VC-1' : id));
    expect(view.cards[0]!.machines).toEqual([
      { id: 'HMC-2', label: 'VC-1', href: '/analytics/machines/HMC-2' },
    ]);
    expect(view.risk[0]!.label).toBe('VC-1 FMH 500');
  });

  it('carries no money: no rupee, no money tile', () => {
    const text = JSON.stringify(VIEW);
    expect(text).not.toMatch(/₹|spares-spend|"money"/i);
  });
});

describe('the filters and the banner', () => {
  it('filters by tab, priority, type and search without re-sorting', () => {
    const open = filterCards(VIEW.cards, OPEN);
    expect(open).toHaveLength(33);
    expect(open.map((card) => card.key)).toEqual(
      VIEW.cards.filter((card) => card.status === 'open').map((card) => card.key),
    );
    expect(filterCards(VIEW.cards, { ...OPEN, severity: 'high' })).toHaveLength(6);
    expect(filterCards(VIEW.cards, { ...OPEN, rule: 'rise' })).toHaveLength(5);
    // The age nudge names HMC-2 among its five machines, so the search reads machines as well as titles.
    expect(filterCards(VIEW.cards, { ...OPEN, query: 'HMC-2' })).toHaveLength(3);
    expect(filterCards(VIEW.cards, { ...OPEN, query: 'hmc-2' })).toHaveLength(3);
    expect(filterCards(VIEW.cards, { ...OPEN, status: 'resolved' })).toHaveLength(1);
  });

  it('groups the cards under their priority headings, high first', () => {
    const groups = severityGroups(filterCards(VIEW.cards, OPEN));
    expect(groups.map((group) => [group.severity, group.cards.length])).toEqual([
      ['high', 6],
      ['med', 25],
      ['low', 2],
    ]);
    expect(groups[0]!.labelKey).toBe('analytics.actionCenter.tile.high');
  });

  it('banners the open high and medium counts, and hides with nothing open', () => {
    expect(bannerOf(BOARD)).toEqual({ high: 6, medium: 25 });
    expect(bannerOf({ ...BOARD, counts: { open: 0, ack: 0, snoozed: 0, resolved: 0 } })).toBeNull();
  });
});

describe('plant dates', () => {
  it('prints a plant day as DD-MM-YYYY and reads an instant in the plant zone', () => {
    expect(dmy('2026-11-11')).toBe('11-11-2026');
    expect(dmy(null)).toBe('');
    expect(dmy('not a date')).toBe('');
    expect(plantDayOf('2026-11-18T20:00:00.000Z', 'Asia/Kolkata')).toBe('2026-11-19');
    expect(plantDayOf('2026-11-18T20:00:00.000Z', 'UTC')).toBe('2026-11-18');
  });
});
