import { Link, type To } from 'react-router-dom';
import { useOnline, type Resource } from '../data/index.js';
import { Chart } from '../ui/chart/chart.js';
import type { ChartSpec } from '../ui/chart/use-chart.js';
import { Card } from '../ui/card.js';
import { Stack } from '../ui/layout.js';
import { PatternFrame, StateNotice } from './frame.js';
import { viewState, type ViewState } from './view-state.js';

export interface KpiTile {
  label: string;
  /** Formatted by the caller. */
  value: string;
  /** The drill-down target. */
  to?: To;
}
export interface DashboardPageProps<T> {
  title: string;
  resource: Resource<T, unknown>;
  kpis: (data: T) => KpiTile[];
  charts: (data: T) => ChartSpec[];
  /** Shown for a not_found answer. */
  empty: string;
}

const TILE = 'flex min-h-target flex-col gap-1 rounded-2xl bg-surface p-4 shadow-card';

/** KPI tiles that can drill down, then chart cards; loading, empty, error and offline states. */
export function DashboardPage<T>(p: DashboardPageProps<T>) {
  const online = useOnline();
  const one = p.resource.useOne();
  const data = one.data;
  const state = viewState({
    online,
    hasData: data !== undefined,
    isEmpty: false,
    error: one.error,
  });
  return (
    <PatternFrame title={p.title}>
      {state === 'ready' && data !== undefined ? (
        <Stack gap={4}>
          <ul className="grid grid-cols-2 gap-3">
            {p.kpis(data).map(({ label, value, to }) => {
              const inner = (
                <>
                  <span className="text-footnote text-neutral-600">{label}</span>
                  <span className="text-title1 font-semibold tabular-nums">{value}</span>
                </>
              );
              return (
                <li key={label}>
                  {to ? (
                    <Link
                      to={to}
                      className={`${TILE} focus-visible:outline-2 focus-visible:outline-accent-strong`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className={TILE}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {p.charts(data).map((spec) => (
            <Card key={spec.title}>
              <Chart spec={spec} />
            </Card>
          ))}
        </Stack>
      ) : (
        <StateNotice
          state={state as Exclude<ViewState, 'ready'>}
          empty={p.empty}
          onRetry={() => void one.refetch()}
        />
      )}
    </PatternFrame>
  );
}
