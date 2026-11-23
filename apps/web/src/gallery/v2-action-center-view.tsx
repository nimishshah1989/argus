import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ActionCenterView } from '../screens/v2/action-center/View.js';
import { useScreenModel } from '../screens/v2/data.js';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useNav } from '../screens/v2/nav.js';
import { ScreenStates } from '../ui/v2/screen-states.js';
import { previewProvider } from './v2-preview.js';

/**
 * The v2 Action Center as the app runs it, on the real engine's board for the frozen plant (the gallery has no server):
 * the model through the shared seam, the load states from the kit inside the same shell. A write goes nowhere here.
 */
export default function V2ActionCenterView() {
  const [params] = useSearchParams();
  const state = params.get('state');
  const provider = useMemo(() => previewProvider<'action-center'>(state), [state]);
  const loaded = useScreenModel('action-center', {}, provider);
  const nav = useNav('today');
  const { t } = useTranslation();
  const title = t('analytics.screen.action-center');
  if (loaded.state !== 'ready' || !loaded.model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  return <ActionCenterView model={loaded.model} nav={nav} title={title} />;
}
