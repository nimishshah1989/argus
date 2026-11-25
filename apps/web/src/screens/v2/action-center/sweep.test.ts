// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { actionCenterModel } from './adapter.js';
import { actionCenterSheets, riskReasons } from './sweep.js';
import { PEOPLE, recordedBoard } from './test-board.js';
import { ActionCenterView } from './View.js';

/** Sweep #706 batch A on the Action Center (ADR 0041): the risk reasons as chips, and the Excel of its two tables. */
const t = (key: string, values?: Record<string, string | number>) =>
  i18n.t(key, { ...values }) as string;
const BOARD = recordedBoard();
const LABELS = Object.values(BOARD.types);
const CODES = [...new Set(BOARD.nudges.flatMap((n) => n.machines))];
const model = actionCenterModel(
  {
    board: BOARD,
    machines: CODES.map((code) => ({ id: code, code, category: null })),
    people: PEOPLE,
    timeZone: 'Asia/Kolkata',
  },
  t,
);

describe('riskReasons', () => {
  it('splits the engine’s joined labels by the labels themselves, never by spaces', () => {
    expect(riskReasons('Frequent breakdowns Recurring fault Ageing machines', LABELS)).toEqual([
      { text: 'Frequent breakdowns' },
      { text: 'Recurring fault' },
      { text: 'Ageing machines' },
    ]);
  });

  it('reads the engine’s count after a label', () => {
    expect(riskReasons('Long breakdown x3 Slow repairs', LABELS)).toEqual([
      { text: 'Long breakdown', n: 3 },
      { text: 'Slow repairs' },
    ]);
  });

  it('reads every risk row of the board into at least one reason, keeping its words', () => {
    for (const row of BOARD.risk) {
      const reasons = riskReasons(row.why, LABELS);
      expect(reasons.length).toBeGreaterThan(0);
      expect(reasons.map((r) => r.text).join(' ')).toBe(row.why.replace(/ [x×]\d+/g, ''));
    }
  });
});

describe('actionCenterSheets', () => {
  const sheets = () => actionCenterSheets(model);

  it('gives the nudges table, header first, one row per nudge', () => {
    const [nudges] = sheets();
    const { columns } = model.words;
    expect(nudges!.name).toBe(model.words.table.title);
    expect(nudges!.rows[0]).toEqual([
      columns.priority,
      columns.nudge,
      columns.type,
      columns.entries,
      columns.latest,
      columns.status,
    ]);
    expect(nudges!.rows).toHaveLength(model.nudges.length + 1);
    const first = model.nudges[0]!;
    expect(nudges!.rows[1]!.slice(0, 5)).toEqual([
      first.severityLabel,
      first.titleText,
      first.ruleLabel,
      first.count,
      first.latest.shown,
    ]);
  });

  it('gives the risk table, the score as a number', () => {
    const [, risk] = sheets();
    const { risk: words } = model.words;
    expect(risk!.name).toBe(words.table.title);
    expect(risk!.rows[0]).toEqual([words.machine, words.score, words.why]);
    expect(risk!.rows.slice(1)).toEqual(
      model.risk.map((r) => [`${r.machine?.label ?? ''} ${r.model}`.trim(), r.score.value, r.why]),
    );
  });
});

describe('the page with the kit pieces', () => {
  const out = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/analytics/today/action-center'] },
      createElement(ActionCenterView, {
        model,
        nav: [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }],
        title: 'Action Center',
      }),
    ),
  );

  it('draws the four counts as a tile set, the reasons as chips, and offers the Excel', () => {
    expect(out).toContain('class="v2-tile-set"');
    expect(out).toContain('class="v2-reason"');
    expect(out).toContain('Download Excel');
  });
});
