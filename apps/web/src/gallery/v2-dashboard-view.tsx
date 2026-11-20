import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useNav } from '../screens/v2/nav.js';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { dashboardFixture } from '../screens/v2/dashboard/fixture.js';
import { ScreenStates, type Loaded } from '../ui/v2/screen-states.js';
import type { DemoModel } from '../screens/v2/dashboard/fixture-model.js';
import { DemoView } from './v2-dashboard-demo.js';

/** The demo's load states, previewed with `&state=loading|empty|error`. */
function previewLoad(state: string | null): Loaded<DemoModel> {
  const retry = () => {};
  if (state === 'loading') return { state: 'loading', retry };
  if (state === 'empty') return { state: 'empty', retry };
  if (state === 'error') return { state: 'error', retry };
  return { state: 'ready', model: dashboardFixture, retry };
}

/**
 * The kit's plant demo: the decision-first page the v2 look was approved on, on its invented plant. It is the host the
 * entity-chip, drawer and plant-map tests run on; the real Dashboard is the live screen at `/analytics/today`.
 */
export default function V2DashboardView() {
  const [params] = useSearchParams();
  const loaded = previewLoad(params.get('state'));
  const nav = useNav('today');
  const { t } = useTranslation();
  const title = t('analytics.screen.dashboard');
  const [decided, setDecided] = useState<ReadonlySet<string>>(new Set());
  const set = (id: string, on: boolean) =>
    setDecided((was) => {
      const next = new Set(was);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  if (loaded.state !== 'ready' || !loaded.model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  const model = loaded.model;
  return (
    <DemoView
      model={{
        ...model,
        decisions: model.decisions.map((d) => ({ ...d, decided: decided.has(d.id) })),
      }}
      nav={nav}
      title={title}
      onDecide={(id) => set(id, true)}
      onUndo={(id) => set(id, false)}
    />
  );
}
