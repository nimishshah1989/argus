import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useScreenModel } from '../screens/v2/data.js';
import { WhyWhyView } from '../screens/v2/why-why/View.js';
import { useNav } from '../screens/v2/nav.js';
import { ScreenStates } from '../ui/v2/screen-states.js';
import { previewProvider } from './v2-preview.js';

/** The v2 why-why screen as it will run: the model through the shared seam, the load states from the kit in the same shell. */
export default function V2WhyWhyView() {
  const [params] = useSearchParams();
  const provider = useMemo(() => previewProvider<'why-why'>(params.get('state')), [params]);
  const loaded = useScreenModel('why-why', {}, provider);
  const nav = useNav('reliability');
  const { t } = useTranslation();
  const title = t('v2r.ww.title');
  if (loaded.state !== 'ready' || !loaded.model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  return <WhyWhyView model={loaded.model} nav={nav} title={title} />;
}
