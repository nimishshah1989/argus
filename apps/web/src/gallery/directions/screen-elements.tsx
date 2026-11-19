/* eslint-disable i18next/no-literal-string -- only class names, snapshot keys and the sample figure remain; every word goes through t() */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import snapshot from './generated/figures.json' with { type: 'json' };
import type { ScreenProps } from './direction-props.js';
import { FramedChart } from './parts-chart.js';
import { PaletteStrip } from './parts-palette.js';
import { Tile, TileGrid, type TileFigure } from './parts-tile.js';
import { addStrings } from './strings.js';
import { formatIN } from './variant.js';

addStrings({
  'elements.tiles': 'Tiles',
  'elements.breakdowns': 'Breakdowns',
  'elements.pm': 'Planned maintenance',
  'elements.availability': 'Availability',
  'elements.sample': 'A million, grouped the Indian way',
  'elements.charts': 'Charts',
  'elements.chart': 'Breakdown and planned maintenance hours by cell',
  'elements.cell': 'Cell',
  'elements.bd': 'Breakdown hours',
  'elements.pmHours': 'PM hours',
  'elements.palette': 'Palette',
});

/** One figure of the plant's snapshot (the 11 November answer key). */
function figure<T>(key: string): T {
  return snapshot.figures.find((f) => f.key === key)?.value as T;
}

interface CellTable {
  pages: { tables: { header: string[]; rows: string[][] }[] }[];
}

/** The first six rows of A1's by-cell table (breakdown and PM hours), its text cells read back as whole hours. */
function byCell(): { cells: string[]; bd: number[]; pm: number[] } {
  const table = figure<CellTable>('a1-bd-pm').pages[0]!.tables[0]!;
  const rows = table.rows.slice(0, 6);
  const column = (name: string) =>
    rows.map((row) => Math.round(Number(row[table.header.indexOf(name)]!.replace(/,/g, ''))));
  return { cells: rows.map((row) => row[0]!), bd: column('BD Hrs'), pm: column('PM Hrs') };
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-body font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Tiles({ direction }: Pick<ScreenProps, 'direction'>) {
  const { t } = useTranslation('directions');
  const tiles: TileFigure[] = [
    {
      label: t('elements.breakdowns'),
      value: figure<number>('dashboard.total-breakdowns'),
      change: { pct: 12, up: true, tone: 'critical' },
    },
    {
      label: t('elements.pm'),
      value: figure<number>('dashboard.pm-hours'),
      unit: 'h',
      change: { pct: 4, up: true, tone: 'good' },
    },
    {
      label: t('elements.availability'),
      value: figure<number>('dashboard.fleet-availability'),
      unit: '%',
      change: { pct: 0.2, up: false, tone: 'attention' },
    },
  ];
  return (
    <TileGrid variant={direction.variant}>
      {tiles.map((f) => (
        <Tile key={f.label} variant={direction.variant} figure={f} />
      ))}
    </TileGrid>
  );
}

function Chart({ direction }: Pick<ScreenProps, 'direction'>) {
  const { t } = useTranslation('directions');
  const { cells, bd, pm } = byCell();
  return (
    <FramedChart
      variant={direction.variant}
      spec={{
        kind: 'bar',
        title: t('elements.chart'),
        categoryLabel: t('elements.cell'),
        categories: cells,
        series: [
          { name: t('elements.bd'), values: bd },
          { name: t('elements.pmHours'), values: pm },
        ],
      }}
    />
  );
}

/** The Elements screen: each part drawn the way the direction's variant says. The changes on October are sample figures. */
export default function ScreenElements(props: ScreenProps) {
  const { t } = useTranslation('directions');
  return (
    <div className="flex flex-col gap-6">
      <Section id="elements-tiles" title={t('elements.tiles')}>
        <Tiles direction={props.direction} />
        <p className="text-footnote text-neutral-600">{t('elements.sample')}</p>
        <p
          data-sample
          className="text-title1 font-semibold"
          style={{ fontFamily: 'var(--proto-display)', letterSpacing: 'var(--proto-tracking)' }}
        >
          {formatIN(1000000)}
        </p>
      </Section>
      <Section id="elements-charts" title={t('elements.charts')}>
        <Chart direction={props.direction} />
      </Section>
      <Section id="elements-palette" title={t('elements.palette')}>
        <PaletteStrip {...props} />
      </Section>
    </div>
  );
}
