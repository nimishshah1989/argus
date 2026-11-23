import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import { levelOf, type HeatMatrixData, type HeatRow } from '../../../ui/v2/domain/heat-matrix.js';
import type { Point } from '../../../ui/v2/points.js';
import { FIGURE_LABELS } from '../../analytics/groups.js';
import type { PageTable } from '../../analytics/page-content.js';
import type { Translate } from '../figures/read.js';
import { chartOf, figuresOf, tablesOf } from '../printed-page/page-model.js';
import type { PageWords } from '../printed-page/page-model.js';
import {
  cellChip,
  machineChip,
  numberValue,
  pageOf,
  shortDate,
  type Figure,
  type FiguresPart,
  type Page,
} from '../printed-page/printed.js';
import { say, strong } from '../printed-page/segs.js';
import { verdictOf } from '../printed-page/verdict.js';
import { pageWords } from '../printed-page/words.js';
import { drillFor } from '../rows-behind/drill.js';
import type { ShiftModel, ShiftSection } from './model.js';

const SCREEN = 'shift-kpis';
const COMPARE = 'shift-kpis.compare';
const BACKLOG = 'shift-kpis.backlog';
const MAP = 'shift-kpis.breakdown-map';
/** The screen's own name in English, which the engine also uses as the first figure's title. */
const SCREEN_NAME = 'Shift-calendar KPIs';
/** The two columns of a heat grid that are sums, not months: printed plain, never tinted. */
const PLAIN = new Set(['Total', 'Cumulative %']);
/** A figure whose printed count is the number of tickets it opens: the count itself carries the drill. */
const COUNTED: Record<string, string> = { [COMPARE]: 'Failures', [BACKLOG]: 'Open Breakdowns' };

const dash = (cell: string) => cell.trim() === '' || cell.trim() === '—';

/** A printed heat cell as a number (grouping commas and a % read); null for a dash. */
const numeric = (cell: string): number | null => {
  const value = Number(cell.replaceAll(',', '').replace('%', '').trim());
  return dash(cell) || !Number.isFinite(value) ? null : value;
};

/**
 * The engine's heat table as a matrix: every printed cell kept, the month cells tinted by weight against the whole
 * table's range, the total and the share passed printed plain, and a month with no hours left as a dash.
 */
function heatMatrix(
  table: PageTable,
  id: string,
  words: ShiftModel['words'],
  t: TFunction,
): HeatMatrixData {
  const heated = table.header.map((label, at) => at > 0 && !PLAIN.has(label));
  const values = table.rows.flatMap((row) =>
    row
      .flatMap((cell, at) => (heated[at] ? [numeric(cell)] : []))
      .filter((v): v is number => v !== null),
  );
  const [min, max] = [Math.min(...values), Math.max(...values)];
  const first = table.header[0] ?? '';
  const rows: HeatRow[] = table.rows.map((row) => {
    const head = row[0] ?? '';
    const cells = row.flatMap((cell, at) => {
      if (!heated[at]) return [];
      const value = numeric(cell);
      const label = table.header[at] ?? '';
      return [
        {
          text: cell,
          level: value === null ? null : levelOf(value, min, max, true),
          name: fill(words.heatCell, {
            row: head,
            column: label,
            value: value === null ? words.noHours : cell,
          }),
        },
      ];
    });
    const chip =
      first === 'Machine' && head !== ''
        ? machineChip(head)
        : first === 'Cell' && /^\d+$/.test(head)
          ? cellChip(fill(t('v2r.cell'), { n: head }))
          : undefined;
    return {
      head: chip ? chip.label : head,
      ...(chip ? { chip } : {}),
      cells,
      plain: row.filter((_, at) => at > 0 && !heated[at]),
    };
  });
  return {
    id,
    title: table.title,
    header: {
      first,
      cells: table.header.filter((_, at) => heated[at]),
      plain: table.header.filter((label, at) => at > 0 && !heated[at] && label !== undefined),
    },
    rows,
  };
}

/** A figure's heading: the engine's own title, unless it only repeats the screen's name, when the catalogue's label says what it is. */
export const headingOf = (title: string, label: string): string =>
  title === '' || title === SCREEN_NAME ? label : title;

function sectionOf(
  entry: { figure: Figure; page: Page },
  ctx: { reply: FiguresPart; words: ShiftModel['words']; t: TFunction },
): ShiftSection {
  const { figure, page } = entry;
  const { reply, words, t } = ctx;
  const say_: Translate = (key, values) => t(key, { ...values }) as string;
  const drill = drillFor(reply, figure.key, say_);
  const counted = COUNTED[figure.key];
  /** Only a count that equals the rows behind it opens them; any other figure's drill is the section's own action. */
  const onCount =
    drill !== undefined && counted !== undefined
      ? page.kpis.findIndex(
          (kpi) => kpi.label === counted && numberValue(kpi.value) === figure.drill.ids.length,
        )
      : -1;
  const plain = page.tables.filter((table) => table.heat !== true);
  return {
    id: figure.key,
    title: headingOf(page.title, t(FIGURE_LABELS[figure.key] ?? 'analytics.screen.unknown')),
    figures: figuresOf(page.kpis).map((kpi, at) =>
      at === onCount && drill ? { ...kpi, drill } : kpi,
    ),
    charts: page.charts.map((spec) => chartOf(spec, words)),
    tables: tablesOf(plain, words),
    heat: page.tables
      .filter((table) => table.heat === true)
      .map((table, at) => heatMatrix(table, `${figure.key}-${at}`, words, t)),
    ...(drill && onCount < 0 ? { drill } : {}),
  };
}

/** A figure the engine has not computed keeps its place and says so, as v1 did: never a missing section. */
const notComputed = (figure: Figure, t: TFunction): ShiftSection => ({
  id: figure.key,
  title: t(FIGURE_LABELS[figure.key] ?? 'analytics.screen.unknown'),
  figures: [],
  charts: [],
  tables: [],
  heat: [],
  notComputed: true,
});

const rowOf = (page: Page | undefined, first: string): string[] | undefined =>
  page?.tables.flatMap((table) => table.rows).find((row) => row[0] === first);

function headline(compare: Page | undefined, t: TFunction): Point {
  const [mtbf, mttr, availability] = ['MTBF (hours)', 'MTTR (hours)', 'Availability (%)'].map(
    (label) => rowOf(compare, label),
  );
  if (!mtbf || !mttr || !availability) return [{ text: t('v2r.noFigures') }];
  return say(t('v2s.headline'), {
    mtbf: strong(mtbf[2] ?? ''),
    platform: mtbf[1] ?? '',
    mttr: strong(mttr[2] ?? ''),
    availability: availability[2] ?? '',
  });
}

function backlogLine(backlog: Page | undefined, t: TFunction): Point | null {
  const open = backlog?.kpis.find((kpi) => kpi.label === 'Open Breakdowns');
  const oldest = backlog?.kpis.find((kpi) => kpi.label === 'Oldest');
  return open && oldest
    ? say(t('v2s.backlog'), { open: strong(open.value), oldest: oldest.value })
    : null;
}

function halfLine(map: Page | undefined, t: TFunction): Point | null {
  const [machines, cells] = ['Machines for half the hours', 'Cells for half the hours'].map(
    (label) => map?.kpis.find((kpi) => kpi.label === label),
  );
  return machines && cells
    ? say(t('v2s.half'), { machines: strong(machines.value), cells: cells.value })
    : null;
}

function wordsOf(t: TFunction): ShiftModel['words'] {
  const base: PageWords = pageWords(t, 'v2s.source');
  return {
    ...base,
    heat: { low: t('v2s.heat.low'), high: t('v2s.heat.high') },
    heatCell: t('v2s.heat.cell'),
    noHours: t('v2s.heat.none'),
    notComputed: t('analytics.notComputed'),
  };
}

/**
 * The Shift-calendar KPIs from the engine's four `shift-kpis` figures, in its order: the platform basis beside the
 * working-hour basis, the shift split, the backlog by working-hour age, and the breakdown map (Pareto charts and four
 * heat grids by machine, cell, code and shift). Every figure, chart, table and heat cell is as printed. A count that
 * equals the tickets behind it opens them; the other figures open theirs from the section's own action. Null when
 * the engine computed none of them.
 */
export function shiftKpisModel(reply: FiguresPart, t: TFunction): ShiftModel | null {
  const words = wordsOf(t);
  const own = reply.figures
    .filter((figure) => figure.screen === SCREEN)
    .map((figure) => ({ figure, page: pageOf(figure, t) }));
  if (own.every((entry) => entry.page === null)) return null;
  const page = (key: string) => own.find((entry) => entry.figure.key === key)?.page ?? undefined;
  const source = fill(words.source, { date: shortDate(reply.asOf) });
  return {
    verdict: verdictOf(
      headline(page(COMPARE), t),
      [backlogLine(page(BACKLOG), t), halfLine(page(MAP), t)],
      source,
    ),
    sections: own.map(({ figure, page: printed }) =>
      printed === null
        ? notComputed(figure, t)
        : sectionOf({ figure, page: printed }, { reply, words, t }),
    ),
    source,
    words,
  };
}
