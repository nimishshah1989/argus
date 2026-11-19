/* eslint-disable i18next/no-literal-string -- only class names, snapshot keys and unit signs remain; every word goes through t() */
import { useTranslation } from 'react-i18next';
import type { StatusRef } from '../../ui/meaning.js';
import { chartOf, figure, monthsSoFar } from './figures.js';
import type { ScreenProps } from './direction-props.js';
import { FramedChart } from './parts-chart.js';
import { AsOf, Section } from './parts-section.js';
import { StatusChip } from './parts-status.js';
import { NBSP, Tile, TileGrid, type TileFigure } from './parts-tile.js';
import { addStrings } from './strings.js';
import { formatIN } from './variant.js';

addStrings({
  'today.tiles': 'This year so far',
  'today.breakdowns': 'Breakdowns',
  'today.downtime': 'Breakdown downtime',
  'today.availability': 'Availability',
  'today.complaints': 'Average complaints',
  'today.perDay': 'a day',
  'today.pm': 'Planned maintenance',
  'today.free': 'Machines without a breakdown',
  'today.of': 'of {{total}}',
  'today.problems': 'Costliest problems',
  'today.count': '{{count}} breakdowns',
  'today.trend': 'Hours by month',
  'today.trendChart': 'Breakdown and planned maintenance hours by month',
  'today.month': 'Month',
  'today.bd': 'Breakdown hours',
  'today.pmHours': 'PM hours',
  'today.tones': 'What each colour says',
});

interface ProblemList {
  rows: { problem: string; hours: number; share: number; breakdowns: number }[];
}

/** One of each tone role: red Stopped, amber Waiting, green Done, blue Transferred and grey Running. */
const TONE_STRIP: StatusRef[] = [
  { group: 'ticket', id: 'stopped' },
  { group: 'ticket', id: 'waiting' },
  { group: 'pm', id: 'done' },
  { group: 'ticket', id: 'transferred' },
  { group: 'ticket', id: 'running' },
];

function Tiles({ direction }: Pick<ScreenProps, 'direction'>) {
  const { t } = useTranslation('directions');
  const free = figure<{ runningClean: number; inService: number }>('dashboard.breakdown-free');
  const tiles: TileFigure[] = [
    {
      label: t('today.breakdowns'),
      value: figure('dashboard.total-breakdowns'),
      tone: 'critical',
    },
    {
      label: t('today.downtime'),
      value: figure('dashboard.total-downtime-hours'),
      unit: 'h',
      tone: 'critical',
    },
    {
      label: t('today.availability'),
      value: figure('dashboard.fleet-availability'),
      unit: '%',
      tone: 'good',
    },
    {
      label: t('today.complaints'),
      value: figure('dashboard.avg-complaints-per-day'),
      unit: t('today.perDay'),
      tone: 'attention',
    },
    { label: t('today.pm'), value: figure('dashboard.pm-hours'), unit: 'h', tone: 'good' },
    {
      label: t('today.free'),
      value: free.runningClean,
      unit: t('today.of', { total: formatIN(free.inService) }),
      tone: 'good',
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

/** The costliest problem groups as ranked bars: the bar is the hours, and every row also prints its figures. */
function Problems() {
  const { t } = useTranslation('directions');
  const { rows } = figure<ProblemList>('dashboard.costliest-problems');
  const most = Math.max(...rows.map((r) => r.hours));
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.problem} data-problem className="flex flex-col gap-1">
          <span className="text-body">{row.problem}</span>
          <span
            aria-hidden="true"
            className="block h-2"
            style={{
              width: `${(row.hours / most) * 100}%`,
              borderRadius: 'var(--proto-radius-chip)',
              background: 'var(--color-chart-1)',
            }}
          />
          <span className="text-footnote text-neutral-600">
            {`${formatIN(row.hours)}${NBSP}h \u00b7 ${formatIN(row.share)}${NBSP}% \u00b7 ${t('today.count', { count: row.breakdowns })}`}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A1's monthly breakdown and PM hours, January to the snapshot's month (the months after it have no figure). */
function Trend({ direction }: Pick<ScreenProps, 'direction'>) {
  const { t } = useTranslation('directions');
  const chart = chartOf('a1-bd-pm', 'ch-a1-trend');
  const months = monthsSoFar();
  const hours = (i: number) =>
    chart.datasets[i]!.data.slice(0, months).map((v) => Math.round((v ?? 0) * 10) / 10);
  return (
    <FramedChart
      variant={direction.variant}
      spec={{
        kind: 'line',
        title: t('today.trendChart'),
        categoryLabel: t('today.month'),
        categories: chart.labels.slice(0, months),
        series: [
          { name: t('today.bd'), values: hours(0) },
          { name: t('today.pmHours'), values: hours(1) },
        ],
      }}
    />
  );
}

/** Today: six tiles, the costliest problems, one trend and the five tones, all from the snapshot. */
export default function ScreenToday({ direction }: ScreenProps) {
  const { t } = useTranslation('directions');
  return (
    <div data-screen="today" className="flex flex-col gap-6">
      <AsOf />
      <Section id="today-tiles" title={t('today.tiles')}>
        <Tiles direction={direction} />
      </Section>
      <Section id="today-problems" title={t('today.problems')}>
        <Problems />
      </Section>
      <Section id="today-trend" title={t('today.trend')}>
        <Trend direction={direction} />
      </Section>
      <Section id="today-tones" title={t('today.tones')}>
        <ul data-tone-strip className="flex flex-wrap gap-2">
          {TONE_STRIP.map((status) => (
            <li key={`${status.group}.${status.id}`}>
              <StatusChip status={status} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
