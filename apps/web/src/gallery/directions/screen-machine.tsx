/* eslint-disable i18next/no-literal-string -- only class names, snapshot keys and unit signs remain; every word goes through t() */
import { useTranslation } from 'react-i18next';
import { chartOf, figure, monthsSoFar, tablesOf } from './figures.js';
import { DISPLAY_STYLE, type ScreenProps } from './direction-props.js';
import { FramedChart } from './parts-chart.js';
import { LogTable } from './parts-log.js';
import { AsOf, Section } from './parts-section.js';
import { StatusChip } from './parts-status.js';
import { Tile, TileGrid, type TileFigure } from './parts-tile.js';
import { addStrings } from './strings.js';

addStrings({
  'machine.about': '{{category}}, {{make}} {{model}}. Cell {{cell}}, {{age}} years old.',
  'machine.reliability': 'How reliable it has been',
  'machine.breakdowns': 'Breakdowns',
  'machine.downtime': 'Downtime',
  'machine.mttr': 'Average repair time',
  'machine.mtbf': 'Average time between breakdowns',
  'machine.trend': 'The plant by month',
  'machine.trendChart': 'The plant’s average repair time and time between breakdowns, by month',
  'machine.month': 'Month',
  'machine.mttrName': 'Repair time (h)',
  'machine.mtbfName': 'Between breakdowns (h)',
  'machine.recent': 'Latest 10 breakdowns in the plant',
  'machine.recentNote': 'The snapshot keeps no log per machine, so these are the plant’s latest.',
});

/** What the machine page of the snapshot says about VC-28. */
interface MachineFigures {
  machine: { code: string; category: string; make: string; model: string; cell: string };
  ageYears: number;
  breakdowns: { count: number; hours: number; mttr: number; mtbf: number };
}

const SAMPLE = 'VC-28';

function Header({ m }: { m: MachineFigures }) {
  const { t } = useTranslation('directions');
  const { code, category, make, model, cell } = m.machine;
  return (
    <header data-machine-header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-title3 font-semibold" style={DISPLAY_STYLE}>
          {code}
        </h3>
        <p className="text-footnote text-neutral-600">
          {t('machine.about', { category, make, model, cell, age: m.ageYears })}
        </p>
      </div>
      <StatusChip status={{ group: 'ticket', id: 'running' }} />
    </header>
  );
}

/** The plant's MTTR and MTBF by month (A3), January to the snapshot's month, on two axes. */
function Trend({ direction }: Pick<ScreenProps, 'direction'>) {
  const { t } = useTranslation('directions');
  const chart = chartOf('a3-mttr-mtbf', 'ch-a3-planttrend');
  const months = monthsSoFar();
  const values = (i: number) => chart.datasets[i]!.data.slice(0, months).map((v) => v ?? undefined);
  return (
    <FramedChart
      variant={direction.variant}
      spec={{
        kind: 'line',
        title: t('machine.trendChart'),
        categoryLabel: t('machine.month'),
        categories: chart.labels.slice(0, months),
        series: [
          { name: t('machine.mttrName'), values: values(0) },
          { name: t('machine.mtbfName'), values: values(1) },
        ],
        secondAxis: true,
      }}
    />
  );
}

/** The machine page for VC-28: header with a grey Running chip, four reliability tiles, a trend and the latest breakdowns. */
export default function ScreenMachine({ direction }: ScreenProps) {
  const { t } = useTranslation('directions');
  const m = figure<{ byMachine: Record<string, MachineFigures> }>('machine-page').byMachine[
    SAMPLE
  ]!;
  const { count, hours, mttr, mtbf } = m.breakdowns;
  const tiles: TileFigure[] = [
    { label: t('machine.breakdowns'), value: count, tone: 'critical' },
    { label: t('machine.downtime'), value: hours, unit: 'h', tone: 'critical' },
    { label: t('machine.mttr'), value: mttr, unit: 'h', tone: 'attention' },
    { label: t('machine.mtbf'), value: mtbf, unit: 'h', tone: 'good' },
  ];
  const log = tablesOf('breakdown-log')[0]!.rows.slice(0, 10);
  return (
    <div data-screen="machine" className="flex flex-col gap-6">
      <Header m={m} />
      <AsOf />
      <Section id="machine-reliability" title={t('machine.reliability')}>
        <TileGrid variant={direction.variant}>
          {tiles.map((f) => (
            <Tile key={f.label} variant={direction.variant} figure={f} />
          ))}
        </TileGrid>
      </Section>
      <Section id="machine-trend" title={t('machine.trend')}>
        <Trend direction={direction} />
      </Section>
      <Section id="machine-recent" title={t('machine.recent')}>
        <p className="text-footnote text-neutral-600">{t('machine.recentNote')}</p>
        <LogTable rows={log} caption={t('machine.recent')} />
      </Section>
    </div>
  );
}
