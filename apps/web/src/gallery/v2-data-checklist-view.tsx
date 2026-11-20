import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { DataChecklistView } from '../screens/v2/data-checklist/View.js';
import { useScreenModel } from '../screens/v2/data.js';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useNav } from '../screens/v2/nav.js';
import { ScreenStates } from '../ui/v2/screen-states.js';
import { previewProvider, toggled } from './v2-preview.js';

/**
 * The v2 Data Checklist as a screen will run it: the model through the shared seam (`useScreenModel`), the load
 * states from the kit inside the same shell, and this view standing in for the server on which fixes are sent.
 */
export default function V2DataChecklistView() {
  const [params] = useSearchParams();
  const state = params.get('state');
  const provider = useMemo(() => previewProvider<'data-checklist'>(state), [state]);
  const loaded = useScreenModel('data-checklist', {}, provider);
  const nav = useNav('today');
  const { t } = useTranslation();
  const title = t('analytics.screen.data-checklist');
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
  if (loaded.state !== 'ready' || !loaded.model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  const model = loaded.model;
  return (
    <DataChecklistView
      model={{
        ...model,
        groups: model.groups.map((g) => ({
          ...g,
          checks: g.checks.map((c) => ({ ...c, done: sent.has(c.id) })),
        })),
      }}
      nav={nav}
      title={title}
      onFix={(id) => setSent((was) => toggled(was, id, true))}
      onUndo={(id) => setSent((was) => toggled(was, id, false))}
    />
  );
}
