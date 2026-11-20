import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useNav } from '../screens/v2/nav.js';
import { BulletBar, BulletLegend } from '../ui/v2/bullet-bar.js';
import { KpiCard } from '../ui/v2/kpi-card.js';
import { Panel } from '../ui/v2/panel.js';
import { Pareto } from '../ui/v2/pareto.js';
import { Row } from '../ui/v2/row.js';
import { previewProvider } from './v2-preview.js';
import { bullet, kpis, pareto } from './rows-behind/data.js';
import { viewWords } from './rows-behind/words.js';

/**
 * The rows-behind panel on real drill replies, in the shell every screen runs in: a KPI card, a Pareto and a bullet
 * bar, each with the rows it counted one press away, in the right drawer, in the address bar (`?drawer=figure:<key>`),
 * so Back closes it. `&state=loading|empty|error` shows the drawer's states.
 */
export default function V2RowsBehindView() {
  const [params] = useSearchParams();
  const state = params.get('state');
  const rows = useMemo(() => previewProvider<'rows-behind'>(state), [state]);
  const nav = useNav('today');
  const w = viewWords;
  return (
    <EntityShell nav={nav} title={w.title} rows={rows}>
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
    </EntityShell>
  );
}
