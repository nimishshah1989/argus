import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useScreenModel } from '../screens/v2/data.js';
import { FixFinderView } from '../screens/v2/fix-finder/View.js';
import { useNav } from '../screens/v2/nav.js';
import { ScreenStates } from '../ui/v2/screen-states.js';
import { previewProvider } from './v2-preview.js';

/** The v2 Fix Finder as a screen will run it: the model through the shared seam, the load states from the kit in the same shell. */
export default function V2FixFinderView() {
  const [params] = useSearchParams();
  const provider = useMemo(() => previewProvider<'fix-finder'>(params.get('state')), [params]);
  const loaded = useScreenModel('fix-finder', {}, provider);
  const nav = useNav('problems');
  const { t } = useTranslation();
  const title = t('analytics.screen.fix-finder');
  if (loaded.state !== 'ready' || !loaded.model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  return <FixFinderView model={loaded.model} nav={nav} title={title} />;
}
