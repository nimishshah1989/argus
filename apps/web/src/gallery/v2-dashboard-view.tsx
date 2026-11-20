import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useNav } from '../screens/v2/nav.js';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useScreenModel, type Provider } from '../screens/v2/data.js';
import { DashboardView } from '../screens/v2/dashboard/View.js';
import { ScreenStates } from '../ui/v2/screen-states.js';

/** Providers that show each load state in the gallery: `&state=loading`, `empty` or `error`. */
function previewProvider(state: string | null): Provider<'dashboard'> | undefined {
  if (state === 'loading') return () => new Promise(() => {});
  if (state === 'empty') return () => Promise.resolve(null);
  if (state === 'error') return () => Promise.reject(new Error('preview'));
  return undefined;
}

/**
 * The v2 Dashboard as a screen will run it: the model through the shared seam (`useScreenModel`), the load states
 * from the kit inside the same shell, and this view standing in for the server on which decisions are taken.
 */
export default function V2DashboardView() {
  const [params] = useSearchParams();
  const state = params.get('state');
  const provider = useMemo(() => previewProvider(state), [state]);
  const loaded = useScreenModel('dashboard', {}, provider);
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
    <DashboardView
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
