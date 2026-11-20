import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useScreenModel } from '../screens/v2/data.js';
import { useNav } from '../screens/v2/nav.js';
import { TeamFocusView } from '../screens/v2/team-focus/View.js';
import { ScreenStates } from '../ui/v2/screen-states.js';
import { previewProvider, toggled } from './v2-preview.js';

/**
 * The v2 Team Focus as a screen will run it: the model through the shared seam, the load states from the kit inside
 * the same shell, and this view standing in for the server on which actions are assigned or moved.
 */
export default function V2TeamFocusView() {
  const [params] = useSearchParams();
  const state = params.get('state');
  const provider = useMemo(() => previewProvider<'team-focus'>(state), [state]);
  const loaded = useScreenModel('team-focus', {}, provider);
  const nav = useNav('today');
  const { t } = useTranslation();
  const title = t('analytics.screen.team-focus');
  const [assigned, setAssigned] = useState<ReadonlySet<string>>(new Set());
  const [moved, setMoved] = useState(false);
  if (loaded.state !== 'ready' || !loaded.model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  const model = loaded.model;
  return (
    <TeamFocusView
      model={{
        ...model,
        start: model.start.map((d) => ({ ...d, decided: assigned.has(d.id) })),
        rebalance: model.rebalance && { ...model.rebalance, done: moved },
      }}
      nav={nav}
      title={title}
      onAssign={(id) => setAssigned((was) => toggled(was, id, true))}
      onUnassign={(id) => setAssigned((was) => toggled(was, id, false))}
      onRebalance={() => setMoved(true)}
    />
  );
}
