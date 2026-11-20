import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ActionCenterView } from '../screens/v2/action-center/View.js';
import { useScreenModel } from '../screens/v2/data.js';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useNav } from '../screens/v2/nav.js';
import { ScreenStates } from '../ui/v2/screen-states.js';
import { previewProvider, toggled } from './v2-preview.js';

/**
 * The v2 Action Center as a screen will run it: the model through the shared seam (`useScreenModel`), the load
 * states from the kit inside the same shell, and this view standing in for the server on which decisions are taken.
 */
export default function V2ActionCenterView() {
  const [params] = useSearchParams();
  const state = params.get('state');
  const provider = useMemo(() => previewProvider<'action-center'>(state), [state]);
  const loaded = useScreenModel('action-center', {}, provider);
  const nav = useNav('today');
  const { t } = useTranslation();
  const title = t('analytics.screen.action-center');
  const [decided, setDecided] = useState<ReadonlySet<string>>(new Set());
  if (loaded.state !== 'ready' || !loaded.model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  const model = loaded.model;
  return (
    <ActionCenterView
      model={{
        ...model,
        decisions: model.decisions.map((d) => ({ ...d, decided: decided.has(d.id) })),
      }}
      nav={nav}
      title={title}
      onDecide={(id) => setDecided((was) => toggled(was, id, true))}
      onUndo={(id) => setDecided((was) => toggled(was, id, false))}
    />
  );
}
