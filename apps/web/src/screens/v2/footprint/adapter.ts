import type { FiguresReply } from '@uptimo/shared/analytics';
import { fill } from '../../../i18n/fill.js';
import type { IconName } from '../../../ui/v2/icons.js';
import type { TrendData } from '../../../ui/v2/trend-chart.js';
import { kpiCard, withDrill, sentence, verdictOf } from '../figures/point.js';
import {
  machineChip,
  numberIn,
  pagesOf,
  sourceLine,
  type RegisterTable,
  type Translate,
} from '../figures/read.js';
import { drillFor } from '../rows-behind/drill.js';
import { engineTable, type Cell, type TableModel } from '../figures/table.js';
import { commonWords, tableWords, type CommonWords } from '../figures/words.js';
import type { FootprintModel } from './model.js';

const ICONS: IconName[] = ['machines', 'cell', 'gauge', 'gauge', 'list'];

/** The cumulative column of the growth table, year by year, as marks on a line; the table keeps the printed numbers. */
function growthChart(table: RegisterTable | undefined, t: Translate): TrendData | null {
  const column = table?.header.findIndex((label) => label.startsWith('Cumulative')) ?? -1;
  if (!table || column < 0 || table.rows.length === 0) return null;
  const title = t('v2m.fp.growth');
  return {
    title,
    sub: t('v2m.fp.growthSub'),
    aria: fill(t('v2m.fp.growthAria'), {
      from: table.rows[0]?.[0] ?? '',
      to: table.rows[table.rows.length - 1]?.[0] ?? '',
    }),
    categoryLabel: t('v2m.fp.year'),
    valueLabel: t('v2m.fp.area'),
    categories: table.rows.map((row) => row[0] ?? ''),
    series: [
      {
        name: title,
        values: table.rows.map((row) => numberIn(row[column] ?? '') ?? undefined),
        tone: 'info',
      },
    ],
  };
}

function tableOf(table: RegisterTable, c: CommonWords, t: Translate): TableModel {
  const cellChip = (cell: string): Cell => ({
    text: cell,
    sort: Number(cell) || cell,
    chip: { kind: 'cell', id: cell, label: fill(t('v2m.reg.cell'), { n: cell }) },
  });
  const machine = (cell: string): Cell => ({
    text: cell,
    sort: cell,
    chip: machineChip(cell),
  });
  return engineTable(table, {
    id: table.title ?? 'table',
    title: table.title ?? '',
    words: tableWords(c, table.title ?? '', table.rows.length),
    chip: { Cell: cellChip, Machine: machine },
  });
}

/** The footprint screen from the engine's `a7-footprint` figure; null while the engine has not computed it. */
export function footprintModel(reply: FiguresReply, t: Translate): FootprintModel | null {
  const page = pagesOf(reply, 'a7-footprint')?.[0];
  if (!page) return null;
  const c = commonWords(t);
  const source = sourceLine(c.source, reply.asOf);
  const [mapped, , floor, share] = page.kpis;
  const guide = [t('analytics.guide.footprint.body1'), t('analytics.guide.footprint.body2')];
  const headline =
    floor && share
      ? sentence(t('v2m.fp.headline'), { floor: floor.value, share: share.value })
      : sentence(t('v2m.fp.headlineFew'), { mapped: mapped?.value ?? c.none });
  return {
    verdict: verdictOf(headline, floor?.sub ?? mapped?.sub ?? '', guide),
    kpis: page.kpis.map((kpi, i) =>
      withDrill(
        kpiCard(`fp-${i}`, ICONS[i] ?? 'list', kpi, source),
        i === 0 ? drillFor(reply, 'a7-footprint', t) : undefined,
      ),
    ),
    growth: growthChart(
      page.tables.find((table) => table.header[0] === 'Year'),
      t,
    ),
    tables: page.tables.map((table) => tableOf(table, c, t)),
    source,
    words: { why: c.why },
  };
}
