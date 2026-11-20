import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useScreenModel } from '../screens/v2/data.js';
import { ManpowerView } from '../screens/v2/manpower/View.js';
import { useNav } from '../screens/v2/nav.js';
import { ScreenStates } from '../ui/v2/screen-states.js';
import { previewProvider } from './v2-preview.js';

/** The v2 manpower screen as it will run: the model through the shared seam, the load states from the kit in the same shell. */
export default function V2ManpowerView() {
  const [params] = useSearchParams();
  const provider = useMemo(() => previewProvider<'manpower'>(params.get('state')), [params]);
  const loaded = useScreenModel('manpower', {}, provider);
  const nav = useNav('reliability');
  const { t } = useTranslation();
  const title = t('v2r.mp.title');
  if (loaded.state !== 'ready' || !loaded.model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  return <ManpowerView model={loaded.model} nav={nav} title={title} />;
}
