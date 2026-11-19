/* eslint-disable i18next/no-literal-string -- English-only dev fixtures with invented numbers (like chart-door-view); the section's own headings go through t() */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button.js';
import {
  CellPanel,
  type CellItem,
  DataTable,
  DrillPanel,
  Tags,
  DrillTrail,
  EmptyState,
  ErrorState,
  GroupedNav,
  HeatGrid,
  InsightBanner,
  KpiTile,
  LoadingState,
  PeriodPicker,
  RankedList,
  StatusChip,
  Timeline,
  useClientTable,
} from '../ui/elements/index.js';
import { ElementsGaps } from './elements-gaps.js';
import { ServerLogTable } from './server-log-table.js';
import { Grid, Stack } from '../ui/layout.js';
import {
  CAUSES,
  DOWN_IS_GOOD,
  LONG_LABEL,
  LOG_COLUMNS,
  SMALL_ROWS,
  NAV_GROUPS,
  PERIODS,
  TABLE_LABELS,
  UP_IS_GOOD,
  logText,
  hours,
  money,
  percent,
} from './elements-data.js';

function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section data-testid={`element-${id}`} aria-label={title} className="flex flex-col gap-2">
      <h3 className="text-body font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function SmallTable({ rows }: { rows: typeof SMALL_ROWS }) {
  const table = useClientTable(rows, LOG_COLUMNS, logText, 25);
  return (
    <DataTable
      columns={LOG_COLUMNS}
      rows={table.rows}
      rowKey={(r) => String(r.id)}
      total={table.total}
      page={table.page}
      pageSize={table.pageSize}
      sort={table.sort}
      filter={table.filter}
      labels={TABLE_LABELS}
      onSort={table.onSort}
      onFilter={table.onFilter}
      onPage={table.onPage}
    />
  );
}

function Figures({ worst }: { worst: boolean }) {
  const { t } = useTranslation('gallery');
  const label = worst ? LONG_LABEL : 'Downtime';
  return (
    <>
      <Part id="kpi" title={t('elements.kpi')}>
        <Grid columns={2}>
          <KpiTile
            label={label}
            value={worst ? 1234567 : 12.5}
            format={worst ? money : hours}
            tone="good"
            verdict="On target"
            change={{ measure: DOWN_IS_GOOD, delta: -3 }}
            trend={{ values: [9, 8, 8, 6, 5, 4], label: 'Last 6 weeks' }}
          />
          <KpiTile
            label={worst ? LONG_LABEL : 'Availability'}
            value={worst ? 1234567 : 82.5}
            format={percent}
            tone="bad"
            verdict="Below target"
            change={{ measure: UP_IS_GOOD, delta: -2.5 }}
          />
        </Grid>
      </Part>
      <Part id="chip" title={t('elements.chip')}>
        <div className="flex flex-wrap gap-2">
          <StatusChip tone="good">On target</StatusChip>
          <StatusChip tone="watch">Close to limit</StatusChip>
          <StatusChip tone="bad">{worst ? LONG_LABEL : 'Over limit'}</StatusChip>
          <StatusChip tone="neutral">No target set</StatusChip>
        </div>
      </Part>
      <Part id="insight" title={t('elements.insight')}>
        <Stack gap={2}>
          <InsightBanner tone="bad" title={worst ? LONG_LABEL : 'Three breakdowns this week'}>
            Two on the same machine.
          </InsightBanner>
          <InsightBanner tone="good" title="Downtime is down 3 hrs" />
        </Stack>
      </Part>
    </>
  );
}

function Lists({ worst }: { worst: boolean }) {
  const { t } = useTranslation('gallery');
  const causes = worst ? [] : CAUSES;
  return (
    <>
      <Part id="heat" title={t('elements.heat')}>
        <HeatGrid
          label={t('elements.heat')}
          rows={causes}
          columns={['Mon', 'Tue', 'Wed']}
          values={causes.map((_, r) => [r + 1, (r * 3) % 7, r === 2 ? undefined : 9 - r])}
          format={(v) => `${v} h`}
        />
      </Part>
      <Part id="ranked" title={t('elements.ranked')}>
        <RankedList
          items={causes.map((cause, at) => ({
            id: cause,
            label: at === 0 && worst ? LONG_LABEL : cause,
            value: ((at * 5) % 11) + 1,
            display: `${((at * 5) % 11) + 1} hrs`,
            tone: at === 0 ? 'bad' : 'neutral',
            word: at === 0 ? 'Longest' : undefined,
          }))}
        />
      </Part>
      <Part id="timeline" title={t('elements.timeline')}>
        <Timeline
          label={t('elements.timeline')}
          events={causes.slice(0, 3).map((cause, at) => ({
            id: cause,
            time: `0${5 + at}:02 AM`,
            title: cause,
            detail: at === 0 ? 'Reported by Person 04' : undefined,
            tone: (['bad', 'watch', 'good'] as const)[at],
          }))}
        />
      </Part>
    </>
  );
}

function Tables({ worst }: { worst: boolean }) {
  const { t } = useTranslation('gallery');
  return (
    <>
      <Part id="states" title={t('elements.states')}>
        <Stack gap={2}>
          <EmptyState title="No breakdowns" hint="Try a longer period." />
          <LoadingState label="Loading…" tiles={1} />
          <ErrorState title="Could not load" retryLabel="Try again" onRetry={() => {}} />
        </Stack>
      </Part>
      <Part id="table" title={t('elements.table')}>
        <SmallTable rows={worst ? [] : SMALL_ROWS} />
      </Part>
      <Part id="table-server" title={t('elements.tableServer')}>
        <ServerLogTable />
      </Part>
    </>
  );
}

function Panels() {
  const { t } = useTranslation('gallery');
  const [open, setOpen] = useState(false);
  const cells = [
    {
      id: 'a',
      name: 'Cell A',
      value: '1.25',
      unit: '%',
      tone: 'good',
      tag: { tone: 'good', word: 'Lower than plant' },
      series: [3, 2, 2, null, 1.5],
      seriesLabel: 'Cell A by month',
    },
    {
      id: 'b',
      name: 'Cell B',
      value: '4.1',
      unit: '%',
      tone: 'bad',
      tag: { tone: 'bad', word: 'Higher than plant', more: 'in May' },
      series: [2, 3, 5, 4, 4.1],
      seriesLabel: 'Cell B by month',
    },
    {
      id: 'c',
      name: 'Cell C',
      value: null,
      tone: 'neutral',
      series: [null, null, null, null, null],
      seriesLabel: 'Cell C by month',
    },
  ] satisfies CellItem[];
  return (
    <Stack>
      <CellPanel
        title="Cells against the plant"
        summary="1 of 2 did better"
        cells={cells}
        reference={[2.5, 2.5, 3, 3, 3]}
        partial
        empty="No records yet"
      />
      <Tags
        list={[
          { tone: 'good', word: 'Improving' },
          { tone: 'watch', word: 'Month running', icon: 'clock' },
        ]}
      />
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t('elements.openPanel')}
      </Button>
      <DrillPanel open={open} onClose={() => setOpen(false)} title="Cell B" closeLabel="Close">
        <p>Where the hours went, month by month.</p>
      </DrillPanel>
    </Stack>
  );
}

const FAMILIES = [
  {
    family: 'availability',
    label: 'Availability',
    value: 82.5,
    fmt: percent,
    delta: 1.2,
    measure: UP_IS_GOOD,
  },
  {
    family: 'downtime',
    label: 'Downtime',
    value: 12.5,
    fmt: hours,
    delta: 3,
    measure: DOWN_IS_GOOD,
  },
  {
    family: 'repairs',
    label: 'Repair time',
    value: 4.2,
    fmt: hours,
    delta: -0.4,
    measure: DOWN_IS_GOOD,
  },
  {
    family: 'planned',
    label: 'Planned work',
    value: 64,
    fmt: percent,
    delta: 0,
    measure: UP_IS_GOOD,
  },
] as const;

/** Identity families: a tile and a heat grid in each family's colour; the tone is still said by the chip and the change. */
function Families({ worst }: { worst: boolean }) {
  const { t } = useTranslation('gallery');
  // The panel keeps its family while it slides out (200 ms), so it does not lose its title or edge on the way.
  const [open, setOpen] = useState(false);
  const [family, setFamily] = useState<string>();
  const rows = worst ? [] : ['Cell 1', 'Cell 2', 'Cell 3'];
  return (
    <Part id="family" title={t('elements.family')}>
      <Grid columns={2}>
        {FAMILIES.map((f) => (
          <KpiTile
            key={f.family}
            family={f.family}
            label={worst ? LONG_LABEL : f.label}
            value={f.value}
            format={f.fmt}
            change={{ measure: f.measure, delta: f.delta }}
            trend={{ values: [4, 6, 5, 8, 7, 9], label: `${f.label}, last 6 months` }}
            onOpen={() => {
              setFamily(f.family);
              setOpen(true);
            }}
          />
        ))}
      </Grid>
      <HeatGrid
        label="Downtime by cell and month"
        family="downtime"
        rows={rows}
        columns={['May', 'Jun', 'Jul', 'Aug']}
        values={rows.map((_, r) => [0, 20 + r * 30, 60 + r * 60, 240 - r * 70])}
        format={hours}
      />
      <DrillPanel
        open={open}
        onClose={() => setOpen(false)}
        title={FAMILIES.find((f) => f.family === family)?.label ?? ''}
        closeLabel="Close"
        family={family}
      >
        <p>What this figure is, and how it is worked out.</p>
      </DrillPanel>
    </Part>
  );
}

function Controls({ worst }: { worst: boolean }) {
  const { t } = useTranslation('gallery');
  const [period, setPeriod] = useState<string | undefined>('d7');
  const [range, setRange] = useState({ from: '', to: '' });
  return (
    <>
      <Part id="period" title={t('elements.period')}>
        <PeriodPicker
          label={t('elements.period')}
          periods={PERIODS}
          value={period}
          onChange={setPeriod}
          range={{
            from: { label: 'From', value: range.from },
            to: { label: 'To', value: range.to },
            onChange: (next) => {
              setPeriod(undefined);
              setRange(next);
            },
          }}
        />
      </Part>
      <Part id="nav" title={t('elements.nav')}>
        <GroupedNav
          label={t('elements.nav')}
          groups={NAV_GROUPS}
          current="/gallery"
          headingLevel={4}
        />
      </Part>
      <Part id="panels" title={t('elements.panels')}>
        <Panels />
      </Part>
      <Part id="trail" title={t('elements.trail')}>
        <DrillTrail
          label={t('elements.trail')}
          steps={[
            { label: 'Plant', to: '/gallery' },
            { label: 'Cell 4', to: '/gallery?x=1' },
            { label: worst ? LONG_LABEL : 'Machine 17' },
          ]}
        />
      </Part>
    </>
  );
}

/** Ticket 83: the shared elements of the analytics screens; "Worst case" feeds them a 40-letter label, a 7-digit number and no items. */
export function ElementsSection() {
  const { t } = useTranslation('gallery');
  const [worst, setWorst] = useState(false);
  return (
    <section data-testid="gallery-elements" aria-labelledby="gallery-elements-h">
      <Stack>
        <h2 id="gallery-elements-h" className="text-title3 font-semibold">
          {t('section.elements')}
        </h2>
        <Button variant="secondary" aria-pressed={worst} onClick={() => setWorst(!worst)}>
          {t('elements.worst')}
        </Button>
        <Figures worst={worst} />
        <Families worst={worst} />
        <Lists worst={worst} />
        <Tables worst={worst} />
        <Controls worst={worst} />
        <ElementsGaps />
      </Stack>
    </section>
  );
}
