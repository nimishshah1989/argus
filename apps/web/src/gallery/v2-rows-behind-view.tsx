import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNav } from '../screens/v2/nav.js';
import { BulletBar, BulletLegend } from '../ui/v2/bullet-bar.js';
import { KpiCard } from '../ui/v2/kpi-card.js';
import { Panel } from '../ui/v2/panel.js';
import { Pareto } from '../ui/v2/pareto.js';
import { Row } from '../ui/v2/row.js';
import { bullet, kpis, pareto, rowsFor } from './rows-behind/data.js';
import { RowsBehindHost } from './rows-behind/host.js';
import { tableWords, viewWords } from './rows-behind/words.js';

/** What `&state=loading|empty|error` shows in the drawer; the figure's real rows otherwise. */
function loader(state: string | null) {
  if (state === 'loading') return () => new Promise<never>(() => {});
  if (state === 'empty') return () => Promise.resolve(null);
  if (state === 'error') return () => Promise.reject(new Error('preview'));
  return rowsFor;
}

/**
 * The rows-behind panel on real drill replies: a KPI card, a Pareto and a bullet bar, each with the rows it counted
 * one press away, in the right drawer, in the address bar (`?drawer=figure:<key>`), so Back closes it.
 */
export default function V2RowsBehindView() {
  const [params] = useSearchParams();
  const state = params.get('state');
  const load = useMemo(() => loader(state), [state]);
  const nav = useNav('today');
  const w = viewWords;
  return (
    <RowsBehindHost nav={nav} title={w.title} words={tableWords} load={load}>
      <Row>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </Row>
      <Row>
        <Panel title={w.paretoTitle}>
          <Pareto data={pareto} whyLabel={w.paretoWhyLabel} actions={null} />
        </Panel>
        <Panel title={w.bulletTitle}>
          <BulletBar b={bullet} />
          <BulletLegend words={w.legend} />
        </Panel>
      </Row>
    </RowsBehindHost>
  );
}
