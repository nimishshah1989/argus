/* eslint-disable i18next/no-literal-string -- only class names, snapshot keys and unit signs remain; every word goes through t() */
import { useTranslation } from 'react-i18next';
import { cellNumber, figure, tablesOf } from './figures.js';
import type { ScreenProps } from './direction-props.js';
import { FramedChart, type SeriesChart } from './parts-chart.js';
import { HeatGrid, type HeatRow } from './parts-heat.js';
import { LogTable } from './parts-log.js';
import { AsOf, Section } from './parts-section.js';
import { Tile, TileGrid, type TileFigure } from './parts-tile.js';
import { addStrings } from './strings.js';

addStrings({
  'breakdowns.kpis': 'The plant in numbers',
  'breakdowns.total': 'Breakdowns',
  'breakdowns.downtime': 'Breakdown downtime',
  'breakdowns.share': 'Share of available hours',
  'breakdowns.perMachine': 'Downtime per machine',
  'breakdowns.pareto': 'Problems that cost the most hours',
  'breakdowns.paretoChart': 'Hours by problem, with the running share of all hours',
  'breakdowns.problem': 'Problem',
  'breakdowns.hours': 'Hours',
  'breakdowns.cumulative': 'Share so far (%)',
  'breakdowns.heat': 'Breakdown hours by machine type and cell',
  'breakdowns.repair': 'Repair and gap, by cell',
  'breakdowns.cell': 'Cell',
  'breakdowns.mttrChart': 'Average repair time by cell (hours)',
  'breakdowns.mtbfChart': 'Average time between breakdowns by cell (hours)',
  'breakdowns.mttr': 'Repair time (h)',
  'breakdowns.mtbf': 'Between breakdowns (h)',
  'breakdowns.log': 'Latest breakdowns',
});

const PARETO_ROWS = 8;
const HEAT_ROWS = 6;

/** A10's problem groups, already ranked by hours: bars are the hours, the line is how much of all hours they add up to. */
function pareto(t: (key: string) => string): SeriesChart {
  const rows = tablesOf('a10-problems')[0]!.rows.slice(0, PARETO_ROWS);
  let sum = 0;
  return {
    kind: 'mixed',
    title: t('breakdowns.paretoChart'),
    categoryLabel: t('breakdowns.problem'),
    categories: rows.map((row) => row[0]!.split(' / ')[0]!),
    bars: [{ name: t('breakdowns.hours'), values: rows.map((row) => cellNumber(row[4]!)) }],
    line: {
      name: t('breakdowns.cumulative'),
      values: rows.map((row) => Math.round((sum += cellNumber(row[5]!)) * 10) / 10),
    },
  };
}

/** A2's machines summed per machine type and cell: the heat grid's rows are the types with the most hours. */
function heat(): { cells: string[]; rows: HeatRow[] } {
  const [types, cells, ...byType] = tablesOf('a2-category-cell');
  const names = cells!.rows.map((row) => row[0]!);
  return {
    cells: names.map((name) => name.replace(/^\D+/, '')),
    rows: types!.rows
      .map((type, i) => {
        const values = names.map(() => 0);
        for (const machine of byType[i]!.rows) {
          const at = names.indexOf(`Cell ${machine[1]}`);
          values[at] = values[at]! + Math.round(cellNumber(machine[3]!));
        }
        return { name: type[0]!, values };
      })
      .sort((a, b) => sum(b.values) - sum(a.values))
      .slice(0, HEAT_ROWS),
  };
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** A3's by-cell table as one bar series: the repair time or the time between breakdowns of each cell. */
function byCell(label: string, title: string, name: string, column: number): SeriesChart {
  const rows = tablesOf('a3-mttr-mtbf')[1]!.rows;
  return {
    kind: 'bar',
    title,
    categoryLabel: label,
    categories: rows.map((row) => row[0]!),
    series: [{ name, values: rows.map((row) => cellNumber(row[column]!)) }],
  };
}

function Kpis({ variant }: { variant: ScreenProps['direction']['variant'] }) {
  const { t } = useTranslation('directions');
  const kpis: TileFigure[] = [
    { label: t('breakdowns.total'), value: figure('dashboard.total-breakdowns'), tone: 'critical' },
    {
      label: t('breakdowns.downtime'),
      value: figure('dashboard.total-downtime-hours'),
      unit: 'h',
      tone: 'critical',
    },
    {
      label: t('breakdowns.share'),
      value: figure('dashboard.plant-bd-pct'),
      unit: '%',
      tone: 'attention',
    },
    {
      label: t('breakdowns.perMachine'),
      value: figure('dashboard.avg-bd-hours-per-machine'),
      unit: 'h',
      tone: 'attention',
    },
  ];
  return (
    <TileGrid variant={variant}>
      {kpis.map((f) => (
        <Tile key={f.label} variant={variant} figure={f} />
      ))}
    </TileGrid>
  );
}

/** Breakdowns: a strip of figures, the Pareto, the heat grid, repair and gap bars and the log's 50 rows. */
export default function ScreenBreakdowns({ direction, theme }: ScreenProps) {
  const { t } = useTranslation('directions');
  const grid = heat();
  const { variant } = direction;
  return (
    <div data-screen="breakdowns" className="flex flex-col gap-6">
      <AsOf />
      <Section id="breakdowns-kpis" title={t('breakdowns.kpis')}>
        <Kpis variant={variant} />
      </Section>
      <Section id="breakdowns-pareto" title={t('breakdowns.pareto')}>
        <FramedChart variant={variant} spec={pareto(t)} />
      </Section>
      <Section id="breakdowns-heat" title={t('breakdowns.heat')}>
        <HeatGrid
          cells={grid.cells}
          rows={grid.rows}
          ramp={direction[theme].seq}
          caption={t('breakdowns.heat')}
        />
      </Section>
      <Section id="breakdowns-repair" title={t('breakdowns.repair')}>
        <FramedChart
          variant={variant}
          spec={byCell(t('breakdowns.cell'), t('breakdowns.mttrChart'), t('breakdowns.mttr'), 4)}
        />
        <FramedChart
          variant={variant}
          spec={byCell(t('breakdowns.cell'), t('breakdowns.mtbfChart'), t('breakdowns.mtbf'), 5)}
        />
      </Section>
      <Section id="breakdowns-log" title={t('breakdowns.log')}>
        <LogTable rows={tablesOf('breakdown-log')[0]!.rows} caption={t('breakdowns.log')} />
      </Section>
    </div>
  );
}
