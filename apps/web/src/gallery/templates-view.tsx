/* eslint-disable i18next/no-literal-string -- English-only dev content with invented numbers (like the chart door view); the templates take their words from the screen */
import type { ReactNode } from 'react';
import { Chart } from '../ui/chart/chart.js';
import type { ChartSpec } from '../ui/chart/use-chart.js';
import { Button } from '../ui/button.js';
import { Card } from '../ui/card.js';
import { StatusPill } from '../ui/status/status-pill.js';
import { Template, type TemplateProps } from '../screens/analytics/shell/patterns/template.js';
import type { ViewState } from '../patterns/view-state.js';

/*
 * Ticket 85: each template with invented content, then the overview in its four other states. The tiles, the table
 * and the list below are local placeholders: the real elements are ticket 83's, and the screens swap them in.
 */
const CAUSES = ['Wear', 'Heat', 'Oil', 'Dust'];
const CHART: ChartSpec = {
  kind: 'bar',
  title: 'Hours lost by cause',
  categoryLabel: 'Cause',
  categories: CAUSES,
  series: [{ name: 'Hours', values: [6, 2, 9, 4] }],
};

const Tile = ({ label, value }: { label: string; value: string }) => (
  <Card>
    <span className="text-footnote text-neutral-600">{label}</span>
    <span className="text-title2 font-semibold tabular-nums">{value}</span>
  </Card>
);
const TILES = [
  ['Breakdowns', '42'],
  ['Hours lost', '1,20,000'],
  ['Repair time', '2.5 hrs'],
  ['Availability', '96.4%'],
  ['Open jobs', '7'],
  ['Spend', '₹3,40,000'],
];
const tiles = (n: number) =>
  TILES.slice(0, n).map(([l, v]) => <Tile key={l} label={l!} value={v!} />);

const Lines = ({ rows, label }: { rows: number; label: string }) => (
  <ul className="flex flex-col divide-y divide-neutral-200">
    {Array.from({ length: rows }, (_, i) => (
      <li key={i} className="flex min-h-target-min items-center justify-between gap-2 text-body">
        <span>{`${label} ${i + 1}`}</span>
        <span className="tabular-nums">{(i + 2) * 3}</span>
      </li>
    ))}
  </ul>
);
const Panel = ({ title, rows }: { title: string; rows: number }) => (
  <Card title={title}>
    <Lines rows={rows} label="Machine" />
  </Card>
);

const FILTERS = (
  <>
    <Button variant="secondary">This month</Button>
    <Button variant="secondary">All cells</Button>
  </>
);
const ACTIONS = <Button variant="tonal">Export</Button>;
const TRAIL = <p className="text-footnote text-neutral-600">Analytics / Breakdowns</p>;

const DEMOS: { id: string; props: TemplateProps }[] = [
  {
    id: 'overview',
    props: {
      kind: 'overview',
      title: 'Today at the plant',
      lede: 'Last 7 days against the 7 before',
      actions: ACTIONS,
      filters: FILTERS,
      figures: tiles(6),
      main: (
        <>
          <Chart spec={CHART} />
          <Panel title="Worst machines" rows={4} />
        </>
      ),
      drill: <Lines rows={3} label="Job" />,
      drillTitle: 'Jobs behind the figure',
    },
  },
  {
    id: 'analysis',
    props: {
      kind: 'analysis',
      trail: TRAIL,
      title: 'Why machines stop',
      lede: 'Causes ranked by hours lost',
      actions: ACTIONS,
      filters: FILTERS,
      figures: tiles(4),
      main: <Chart spec={CHART} />,
      aside: <Panel title="Top causes" rows={5} />,
      drill: <Lines rows={3} label="Breakdown" />,
      drillTitle: 'Breakdowns behind Wear',
    },
  },
  {
    id: 'register',
    props: {
      kind: 'register',
      title: 'Breakdown log',
      lede: '1,343 rows, 50 at a time',
      filters: FILTERS,
      figures: tiles(2),
      main: <Panel title="All breakdowns" rows={8} />,
      drill: <Lines rows={4} label="Detail" />,
      drillTitle: 'Breakdown 1,207',
    },
  },
  {
    id: 'entity',
    props: {
      kind: 'entity',
      trail: TRAIL,
      title: 'VMC-04 Vertical Machining Center',
      lede: 'Cell 4, running since 6 am',
      actions: <StatusPill group="ticket" id="running" />,
      figures: tiles(4),
      main: <Panel title="Facts" rows={5} />,
      aside: <Panel title="History" rows={5} />,
    },
  },
  {
    id: 'queue',
    props: {
      kind: 'queue',
      title: 'Needs a decision',
      lede: '7 items, oldest first',
      filters: FILTERS,
      main: <Panel title="Waiting" rows={6} />,
      drill: <Lines rows={3} label="Step" />,
      drillTitle: 'Item 3',
    },
  },
];

const STATES: ViewState[] = ['loading', 'empty', 'error', 'offline'];

function Demo({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section data-testid={`demo-${id}`} aria-label={id} className="flex flex-col gap-3">
      {children}
    </section>
  );
}

export default function TemplatesView() {
  return (
    <main data-testid="templates" className="mx-auto flex max-w-6xl flex-col gap-8 p-4">
      <h1 className="text-title2 font-semibold">Page templates</h1>
      {DEMOS.map(({ id, props }) => (
        <Demo key={id} id={id}>
          <Template {...props} />
        </Demo>
      ))}
      {STATES.map((state) => (
        <Demo key={state} id={`state-${state}`}>
          <Template
            kind="overview"
            title={`Overview, ${state}`}
            filters={FILTERS}
            figures={tiles(4)}
            main={<Chart spec={CHART} />}
            state={state}
            empty="Nothing to show for this period."
            onRetry={() => {}}
          />
        </Demo>
      ))}
    </main>
  );
}
