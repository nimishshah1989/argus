import type { TFunction } from 'i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { CheckData } from '../../../ui/v2/domain/check-row.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { Point } from '../../../ui/v2/points.js';
import { fill } from '../../../i18n/fill.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import { takeawayFor, tagOf, type Item } from '../insight.js';
import { numberValue, shortDate } from '../printed-page/printed.js';
import type { CheckGroup, DataChecklistModel, RecordRow } from './model.js';

/**
 * The Data Checklist from the engine's `data-checklist` figure (DC-1, ADR 0017). The engine sends
 * `{ counts, items: [{ group, key, plain }] }`; `plain` is `"<DD-MM-YYYY> · <machine> — <what>"` for a breakdown or
 * Why-Why item, `"<machine> — <what>"` for a machine item and `"<DD-MM-YYYY> to <DD-MM-YYYY> — <what>"` for a log gap.
 * Everything else the model prints is decided in ADR 0017 and written in the tables below.
 */

/** One open item, as the engine sends it. */
export type ChecklistItem = { group: string; key: string; plain: string };

/** The engine's sixteen groups in its own order (`packages/domain/src/analytics/data-checklist.ts` GROUPS). */
export const GROUPS = [
  'bd_date',
  'bd_mach',
  'bd_hrs',
  'bd_code',
  'bd_done',
  'bd_prob',
  'bd_shift',
  'bd_obs',
  'bd_em',
  'log_gap',
  'ww',
  'mc_age',
  'mc_dim',
  'mc_pw',
  'mc_cell',
  'mc_loc',
] as const;
export type GroupKey = (typeof GROUPS)[number];

/** v1's three parts of the data (`checklist-view.ts`), in v1's order: a group belongs to exactly one. */
export type Section = 'log' | 'machines' | 'analysis';
export const SECTION_ORDER: readonly Section[] = ['log', 'machines', 'analysis'];
export const SECTION_OF = (group: GroupKey): Section =>
  group === 'ww' ? 'analysis' : group.startsWith('mc_') ? 'machines' : 'log';
export const SECTION_LABEL: Record<Section, MessageKey> = {
  log: 'analytics.checklist.section.log',
  machines: 'analytics.checklist.section.machines',
  analysis: 'analytics.checklist.section.analysis',
};

/** ADR 0017 (a): who fixes a part of the data is a role, a person chip `{ kind: 'person', id: 'role:<role>' }`. */
export const OWNER_ROLE: Record<Section, 'supervisor' | 'admin' | 'head'> = {
  log: 'supervisor',
  machines: 'admin',
  analysis: 'head',
};
export const ROLE_LABEL: Record<'supervisor' | 'admin' | 'head', MessageKey> = {
  supervisor: 'account.role.supervisor',
  admin: 'account.role.admin',
  head: 'account.role.head',
};

/** ADR 0017 (d): the platform's "Low" groups change no figure on screen, so they are checks; every other is a gap. */
export const CHECK_ONLY: ReadonlySet<GroupKey> = new Set<GroupKey>(['bd_obs', 'bd_em']);

/** ADR 0017 (e): the one action of a check, by part of the data. Nothing is stored, so a check is never done. */
export const FIX: Record<Section, MessageKey> = {
  log: 'v2dc.fix.log',
  machines: 'v2dc.fix.machines',
  analysis: 'v2dc.fix.analysis',
};

/** How many machine chips a check's state names before "and N more". */
export const STATE_CHIPS = 4;

/**
 * The open items in the figure's value, in the engine's order: an entry that is not an object, or whose `group` is
 * not one of `GROUPS`, or whose `key` / `plain` is not a string, is dropped. A value that is not an object has none.
 */
export function itemsOf(value: unknown): ChecklistItem[] {
  const list: unknown[] = isObject(value) && Array.isArray(value.items) ? value.items : [];
  return list.flatMap((item) =>
    isObject(item) &&
    (GROUPS as readonly unknown[]).includes(item.group) &&
    typeof item.group === 'string' &&
    typeof item.key === 'string' &&
    typeof item.plain === 'string'
      ? [{ group: item.group, key: item.key, plain: item.plain }]
      : [],
  );
}

type Paired = { group: GroupKey; row: RecordRow }[];
const isGap = (g: GroupKey) => !CHECK_ONLY.has(g);

/**
 * The whole screen from the items and the date the engine ran for (`asOf`, `YYYY-MM-DD`): verdict, four KPIs, the
 * parts of the data that fail with their checks, every record, the checks that pass, the source line and the words.
 */
export function checklistModel(
  items: readonly ChecklistItem[],
  asOf: string,
  t: TFunction,
): DataChecklistModel {
  const lost = unregistered(items);
  const paired: Paired = items
    .map((item) => ({ group: item.group as GroupKey, row: recordOf(item, asOf, t, lost) }))
    .sort((a, b) => b.row.open.value - a.row.open.value);
  const records = paired.map((p) => p.row);
  const failing = GROUPS.filter((g) => items.some((i) => i.group === g));
  const groups = groupsOf(failing, paired, t);
  const words = wordsOf(records.length, GROUPS.length - failing.length, t);
  return {
    verdict: verdictOf(failing, records, asOf, t),
    kpis: kpisOf(records, t),
    groups,
    records,
    passing: GROUPS.filter((g) => !failing.includes(g)).map((g) => [{ text: t(`v2dc.pass.${g}`) }]),
    source: t('v2dc.source', { date: shortDate(asOf) }),
    words,
    takeaways: checklistTakeaways({ groups, records, words }, t),
  };
}

/**
 * The three section lines (ADR 0035): the failing checks by their records, the records by the entity they name (all of
 * them, whatever a filter shows), and the passing list in the screen's own words.
 */
export function checklistTakeaways(
  model: Pick<DataChecklistModel, 'groups' | 'records' | 'words'>,
  t: TFunction,
): Takeaways {
  const say = (key: string) => t(key) as string;
  const meaning = { worse: 'high', additive: true } as const;
  const checks: Item[] = model.groups.flatMap((g) =>
    g.checks.map((c) => ({ name: c.title, value: numberValue(c.records), shown: c.records })),
  );
  const named = new Map<string, number>();
  for (const r of model.records) named.set(r.entity.label, (named.get(r.entity.label) ?? 0) + 1);
  const entities: Item[] = [...named].map(([name, n]) => ({ name, value: n, shown: String(n) }));
  return {
    groups: takeawayFor(checks, meaning, say),
    records: takeawayFor(entities, meaning, say),
    passing: { text: model.words.passingSub, tone: 'neutral', tag: tagOf('neutral', say) },
  };
}

function checkOf(g: GroupKey, paired: Paired, t: TFunction): CheckData {
  const mine = paired.filter((p) => p.group === g).map((p) => p.row);
  const seen = new Set<string>();
  const codes = mine.flatMap(({ entity }) =>
    entity.kind === 'machine' && !seen.has(entity.id) && seen.add(entity.id) ? [entity] : [],
  );
  const shown = codes
    .slice(0, STATE_CHIPS)
    .flatMap((e, i) => [...(i ? [{ text: ' ' }] : []), { text: e.label, entity: e }]);
  const rest = codes.length - STATE_CHIPS;
  const state: Point = !codes.length
    ? [{ text: mine[0]?.what ?? '' }]
    : rest > 0
      ? [...shown, { text: ' ' + t('v2dc.more', { count: rest }) }]
      : shown;
  const s = SECTION_OF(g);
  return {
    id: g,
    status: isGap(g) ? 'gap' : 'check',
    statusLabel: t(isGap(g) ? 'v2dc.status.gap' : 'v2dc.status.check'),
    title: t(`v2dc.title.${g}`),
    state,
    impact: t(`v2dc.impact.${g}`),
    records: mine.length.toLocaleString('en-IN'),
    recordsNote: t('v2dc.recordsNote', { count: mine.length }),
    owner: ownerOf(s, t),
    why: [[{ text: t(`v2dc.why.${g}`) }]],
    fix: t(FIX[s]),
    doneText: '',
    done: false,
  };
}

function groupsOf(failing: readonly GroupKey[], paired: Paired, t: TFunction): CheckGroup[] {
  const inSection = (s: Section) => failing.filter((g) => SECTION_OF(g) === s);
  const gapsOf = (s: Section) => inSection(s).filter(isGap).length;
  return SECTION_ORDER.filter((s) => inSection(s).length)
    .sort((a, b) => gapsOf(b) - gapsOf(a))
    .map((s) => {
      const gaps = gapsOf(s);
      const checks = inSection(s).length - gaps;
      return {
        id: s,
        name: t(SECTION_LABEL[s]),
        summary: [
          gaps && t('v2dc.gaps', { count: gaps }),
          checks && t('v2dc.checks', { count: checks }),
        ]
          .filter(Boolean)
          .join(' · '),
        owner: ownerOf(s, t),
        checks: [...inSection(s).filter(isGap), ...inSection(s).filter((g) => !isGap(g))].map((g) =>
          checkOf(g, paired, t),
        ),
      };
    });
}

function kpisOf(records: readonly RecordRow[], t: TFunction): KpiData[] {
  const count = (s: Section) => records.filter((r) => r.area.key === s).length;
  const share = (n: number) =>
    fill(t('insight.yardstick.share'), {
      pct: Math.round((n / records.length) * 100),
      total: records.length.toLocaleString('en-IN'),
    });
  const kpi = (id: string, label: string, n: number, icon: KpiData['icon']): KpiData => ({
    id,
    label,
    icon,
    value: n.toLocaleString('en-IN'),
    delta: { text: '', up: false, good: false },
    yardstick: id === 'records' ? fill(t('insight.yardstick.target'), { value: 0 }) : share(n),
    period: '',
    meaning: t(`v2dc.kpi.${id}.meaning`),
    more: t(`v2dc.kpi.${id}.more`),
  });
  return [
    kpi('records', t('v2dc.kpi.records.label'), records.length, 'list'),
    kpi('log', t(SECTION_LABEL.log), count('log'), 'wrench'),
    kpi('machines', t(SECTION_LABEL.machines), count('machines'), 'machines'),
    kpi('analysis', t(SECTION_LABEL.analysis), count('analysis'), 'problems'),
  ];
}

function verdictOf(
  failing: readonly GroupKey[],
  records: readonly RecordRow[],
  asOf: string,
  t: TFunction,
): DataChecklistModel['verdict'] {
  const count = (s: Section) => records.filter((r) => r.area.key === s).length;
  const most = SECTION_ORDER.reduce((a, s) => (count(s) > count(a) ? s : a));
  const oldest = records[0];
  const gapCount = failing.filter(isGap).length;
  const pass = GROUPS.length - failing.length;
  const headline = !failing.length
    ? t('v2dc.allClear')
    : gapCount
      ? t('v2dc.headline', { pass, total: GROUPS.length, count: gapCount })
      : t('v2dc.headlineNoGap', { pass, total: GROUPS.length });
  return {
    context: t('v2dc.context', { date: shortDate(asOf) }),
    headline: [{ text: headline }],
    why: [
      ...(records.length
        ? [[{ text: t('v2dc.verdict.most', { part: t(SECTION_LABEL[most]), count: count(most) }) }]]
        : []),
      ...(oldest && oldest.open.value >= 0
        ? [
            [
              { text: t('v2dc.verdict.oldest', { count: oldest.open.value }) },
              { text: ' ' },
              { text: oldest.entity.label, entity: oldest.entity },
            ],
          ]
        : []),
    ],
  };
}

function wordsOf(total: number, pass: number, t: TFunction): DataChecklistModel['words'] {
  return {
    why: t('v2p.why'),
    check: { why: t('v2dc.checkWhy'), owner: t('v2dc.owner') },
    allClear: t('v2dc.allClear'),
    passingTitle: t('v2dc.passingTitle'),
    passingSub: t('v2dc.passingSub', { count: pass }),
    ownerIs: t('v2dc.owner'),
    records: {
      title: t('v2dc.records.title'),
      search: t('v2dc.records.search', { count: total }),
      showing: t('v2p.showing'),
      noResults: t('v2dc.records.noResults'),
      open: t('v2p.open'),
      columns: {
        record: t('v2dc.records.record'),
        area: t('v2dc.records.area'),
        owner: t('v2dc.owner'),
        open: t('v2dc.records.open'),
      },
      all: t('v2dc.records.all'),
    },
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const ownerOf = (s: Section, t: TFunction): EntityChipProps => ({
  kind: 'person',
  id: `role:${OWNER_ROLE[s]}`,
  label: t(ROLE_LABEL[OWNER_ROLE[s]]),
});

/** Whole days from a `DD-MM-YYYY` date to `asOf`, in UTC; -1 when the text holds no date. */
function daysSince(printed: string | undefined, asOf: string): number {
  const day = (s: string) => {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s) ?? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return NaN;
    const [a, b, c] = m.slice(1).map(Number) as [number, number, number];
    return (m[1]!.length === 4 ? Date.UTC(a, b - 1, c) : Date.UTC(c, b - 1, a)) / 86_400_000;
  };
  const days = day(asOf) - day(printed ?? '');
  return Number.isNaN(days) ? -1 : Math.max(0, days);
}

/** The report ids (`bd_*|<id>`, `ww|<id>`) whose `bd_mach` check fails: their machine id is not in the register. */
const reportId = (key: string) => key.slice(key.indexOf('|') + 1);
const unregistered = (items: readonly ChecklistItem[]): Set<string> =>
  new Set(items.filter((i) => i.group === 'bd_mach').map((i) => reportId(i.key)));

/** One record per item: head / what split at the first ` — `, the date kept in `what` where the head carries one. */
function recordOf(
  item: ChecklistItem,
  asOf: string,
  t: TFunction,
  lost: ReadonlySet<string>,
): RecordRow {
  const group = item.group as GroupKey;
  const s = SECTION_OF(group);
  const cut = item.plain.indexOf(' — ');
  const head = cut < 0 ? item.plain : item.plain.slice(0, cut);
  const what = cut < 0 ? '' : item.plain.slice(cut + 3);
  const base = { id: item.key, area: { key: s, label: t(SECTION_LABEL[s]) }, owner: ownerOf(s, t) };
  if (group === 'log_gap') {
    const [from = head, to = ''] = head.split(' to ');
    return {
      ...base,
      entity: { kind: 'decision', id: item.key, label: `${shortDate(from)} to ${shortDate(to)}` },
      what,
      open: open(daysSince(from, asOf), t),
    };
  }
  const [first = head, second] = head.split(' · ');
  const [date, code] = second === undefined ? [undefined, first] : [first, second];
  // ADR 0017: a machine the register does not know gets a dash, never its raw id.
  const entity: EntityChipProps =
    (group.startsWith('bd_') || group === 'ww') && lost.has(reportId(item.key))
      ? { kind: 'decision', id: item.key, label: '—' }
      : { kind: 'machine', id: code, label: code };
  return {
    ...base,
    entity,
    what: date ? `${shortDate(date)} · ${what}` : what,
    open: open(daysSince(date, asOf), t),
  };
}

const open = (value: number, t: TFunction) => ({
  shown: value < 0 ? '—' : t('v2dc.days', { count: value }),
  value,
});
