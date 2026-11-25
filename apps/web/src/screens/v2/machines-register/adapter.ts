import type { FiguresReply } from '@uptimo/shared/analytics';
import { fill } from '../../../i18n/fill.js';
import type { IconName } from '../../../ui/v2/icons.js';
import { REGISTER_TABS } from '../../analytics/machine-values.js';
import type { Meaning, Takeaways } from '../../../ui/v2/takeaway.js';
import { kpiCard, sentence, verdictOf } from '../figures/point.js';
import { takeawayFor, type Item } from '../insight.js';
import {
  machineChip,
  numberIn,
  pagesOf,
  sourceLine,
  type RegisterKpi,
  type RegisterPage,
  type Translate,
} from '../figures/read.js';
import { seeMachinesFor } from '../rows-behind/drill.js';
import { engineTable, type Cell, type TableModel } from '../figures/table.js';
import { commonWords, tableWords, type CommonWords } from '../figures/words.js';
import type { RegisterPageModel, RegistersModel } from './model.js';

const NOT_IN_PRODUCTION = ' NOT IN PRODUCTION DATA';
const ICONS: IconName[] = ['machines', 'gauge', 'clock'];

/** A controller card has a "series" count in its line; a make card does not. The first three of the CNC page are its summary. */
function splitKpis(page: RegisterPage): {
  summary: RegisterKpi[];
  controllers: RegisterKpi[];
  makes: RegisterKpi[];
} {
  if (page.id !== 'machines') return { summary: page.kpis, controllers: [], makes: [] };
  const rest = page.kpis.slice(3);
  const controller = (kpi: RegisterKpi) => /\bseries\./.test(kpi.sub ?? '');
  return {
    summary: page.kpis.slice(0, 3),
    controllers: rest.filter(controller),
    makes: rest.filter((kpi) => !controller(kpi)),
  };
}

type SplitHead = { id: string; title: string; header: string[] };

/** A split card as a row: its name and count, its share of the machines, and the line the engine printed about it. */
function splitTable(kpis: RegisterKpi[], head: SplitHead, c: CommonWords): TableModel {
  const { header, title, id } = head;
  const rows = kpis.map((kpi) => {
    const sub = kpi.sub ?? '';
    const share = /^([\d.]+%)/.exec(sub)?.[1] ?? '';
    return [kpi.label, kpi.value, share, sub.replace(/^[\d.]+% of machines\s*(?:[·.]\s*)?/, '')];
  });
  return engineTable(
    { title, header, rows },
    { id, title, words: tableWords(c, title, rows.length) },
  );
}

/** The engine's two lists name a machine by code (in its type's colour) and a cell by number. */
function listTable(
  table: RegisterPage['tables'][number],
  title: string,
  c: CommonWords,
  t: Translate,
): TableModel {
  const idColumn = table.header.includes('DG ID') ? 'DG ID' : 'Machine ID';
  const chipColumn = table.header.includes('Category') ? 'Category' : undefined;
  const machine = (cell: string, row: Record<string, string>): Cell => {
    const code = cell.endsWith(NOT_IN_PRODUCTION) ? cell.slice(0, -NOT_IN_PRODUCTION.length) : cell;
    return {
      text: code,
      sort: code,
      chip: machineChip(code, row.Category),
      ...(code === cell ? {} : { note: cell.slice(code.length).trim() }),
    };
  };
  const place = (cell: string): Cell | null =>
    cell === '—' || cell === ''
      ? null
      : {
          text: cell,
          sort: Number(cell) || cell,
          chip: { kind: 'cell', id: cell, label: fill(t('v2m.reg.cell'), { n: cell }) },
        };
  return engineTable(table, {
    id: 'list',
    title,
    words: tableWords(c, title, table.rows.length),
    chip: { [idColumn]: machine, Cell: place },
    ...(chipColumn ? { chipColumn } : {}),
  });
}

type Ctx = { c: CommonWords; t: Translate; source: string };

function pageModel(page: RegisterPage, label: string, ctx: Ctx): RegisterPageModel {
  const { c, t, source } = ctx;
  const { summary, controllers, makes } = splitKpis(page);
  const [first, ...others] = summary;
  const verdict = verdictOf(
    sentence(t('v2m.reg.headline'), { title: page.title, count: first?.value ?? c.none }),
    others.map((kpi) => `${kpi.label}: ${kpi.value}`).join(' · '),
    [t('analytics.guide.machine-lists.body1')],
  );
  const splits = [
    controllers.length > 0
      ? splitTable(
          controllers,
          {
            id: 'controllers',
            title: t('v2m.reg.controllers'),
            header: [t('v2m.reg.controller'), ...splitHead(t)],
          },
          c,
        )
      : null,
    makes.length > 0
      ? splitTable(
          makes,
          { id: 'makes', title: t('v2m.reg.makes'), header: [t('v2m.reg.make'), ...splitHead(t)] },
          c,
        )
      : null,
  ].filter((table): table is TableModel => table !== null);
  const printed = page.tables.map((table, at) => {
    const list = table.header.includes('Machine ID') || table.header.includes('DG ID');
    return list
      ? listTable(table, table.title ?? t('v2m.reg.list'), c, t)
      : engineTable(
          { ...table, title: table.title ?? '' },
          {
            id: `table-${at}`,
            title: table.title ?? '',
            words: tableWords(c, table.title ?? '', table.rows.length),
          },
        );
  });
  return {
    id: page.id,
    label,
    verdict,
    kpis: summary.map((kpi, i) => kpiCard(`${page.id}-${i}`, ICONS[i] ?? 'list', kpi, source)),
    tables: [...splits, ...printed],
  };
}

type Rows = string[][];

/** Rows as takeaway items: named by one cell, valued by the number in another and shown as printed; a cell with no number leaves the row out. */
const itemsOf = (rows: Rows, name: number, at: number): Item[] =>
  rows.flatMap((row) => {
    const shown = row[at] ?? '';
    const value = numberIn(shown);
    return value === null
      ? []
      : [{ name: (row[name] ?? '').replace(NOT_IN_PRODUCTION, ''), value, shown }];
  });

/** One line per split, per by-category table (machines add up) and per machine list (ages don't), keyed `<page>-<table id>` (ticket 655). */
function takeawaysOf(page: RegisterPage, t: Translate): Takeaways {
  const { controllers, makes } = splitKpis(page);
  const out: Takeaways = {};
  const say = (id: string, rows: Rows, columns: [number, number], meaning: Meaning) => {
    out[`${page.id}-${id}`] = takeawayFor(itemsOf(rows, ...columns), meaning, t);
  };
  const adds: Meaning = { worse: 'high', additive: true };
  for (const [id, kpis] of [
    ['controllers', controllers],
    ['makes', makes],
  ] as const)
    if (kpis.length > 0)
      say(
        id,
        kpis.map((kpi) => [kpi.label, kpi.value]),
        [0, 1],
        adds,
      );
  page.tables.forEach((table, at) => {
    const { header } = table;
    const id = header.includes('DG ID') ? 'DG ID' : 'Machine ID';
    if (header.includes(id))
      say('list', table.rows, [header.indexOf(id), header.indexOf('Age')], { worse: 'high' });
    else if (header[1] === 'Machines') say(`table-${at}`, table.rows, [0, 1], adds);
  });
  return out;
}

const LOADS = ['Connected Load', 'Listed Power'];

/**
 * Each summary card's yardstick, by card id: the count as a share of every page's count, the average age as a rank,
 * a KVA load as a share of the KVA the pages print, the DG's largest set as a share of its capacity. A figure in
 * another unit or with no number gets `v2m.none`.
 * shortcut: no comparable figure in the register reply, upgrade when the engine sends a prior period or peer.
 */
function yardsticksOf(pages: RegisterPage[], t: Translate): Record<string, string> {
  const cards = pages.flatMap((page) =>
    splitKpis(page).summary.map((kpi, i) => ({
      ...kpi,
      at: i,
      page: page.id,
      n: numberIn(kpi.value),
    })),
  );
  const sum = (some: typeof cards) => some.reduce((total, card) => total + (card.n ?? 0), 0);
  const kva = (card: (typeof cards)[number]) => card.n !== null && card.value.endsWith(' KVA');
  const counted = cards.filter((card) => card.at === 0);
  const count = sum(counted);
  const ages = cards.filter((card) => card.label === 'Avg Age' && card.n !== null);
  const load = sum(cards.filter((card) => LOADS.includes(card.label) && kva(card)));
  const loadShown = `${load.toLocaleString('en-US', { maximumFractionDigits: 1 })} KVA`;
  const share = (n: number, total: number, shown: string) =>
    total > 0
      ? fill(t('insight.yardstick.share'), { pct: Math.round((n / total) * 100), total: shown })
      : null;
  const of = (card: (typeof cards)[number]): string | null => {
    const { n } = card;
    if (n === null) return null;
    if (card.at === 0) return share(n, count, String(count));
    if (card.label === 'Avg Age')
      return fill(t('insight.yardstick.rank'), {
        rank: 1 + ages.filter((age) => (age.n ?? 0) > n).length,
        n: ages.length,
      });
    if (!kva(card)) return null;
    if (card.label === 'Largest Set') {
      const capacity = cards.find((c) => c.page === card.page && c.label === 'Generating Capacity');
      return capacity?.n ? share(n, capacity.n, capacity.value) : null;
    }
    return LOADS.includes(card.label) || card.label === 'Generating Capacity'
      ? share(n, load, loadShown)
      : null;
  };
  return Object.fromEntries(
    cards.map((card) => [`${card.page}-${card.at}`, of(card) ?? t('v2m.none')]),
  );
}

const splitHead = (t: Translate): string[] => [
  t('v2m.reg.count'),
  t('v2m.reg.share'),
  t('v2m.reg.detail'),
];

const drillOf = (reply: FiguresReply, t: Translate) => {
  const drill = seeMachinesFor(reply, 'registers', t);
  return drill ? { drill } : {};
};

/** The registers screen from the engine's `registers` figure; null while the engine has not computed it. */
export function registersModel(reply: FiguresReply, t: Translate): RegistersModel | null {
  const found = pagesOf(reply, 'registers');
  if (!found) return null;
  const c = commonWords(t);
  const source = sourceLine(c.source, reply.asOf);
  const label = (id: string) => {
    const tab = REGISTER_TABS.find((candidate) => candidate.id === id);
    return tab ? t(tab.labelKey) : id;
  };
  const yardstick = yardsticksOf(found, t);
  return {
    pages: found.map((page) => {
      const model = pageModel(page, label(page.id), { c, t, source });
      return {
        ...model,
        kpis: model.kpis.map((kpi) => ({ ...kpi, yardstick: yardstick[kpi.id] })),
      };
    }),
    takeaways: Object.assign({}, ...found.map((page) => takeawaysOf(page, t))),
    ...drillOf(reply, t),
    source,
    words: { tabs: t('analytics.registers.tabs'), why: c.why },
  };
}
