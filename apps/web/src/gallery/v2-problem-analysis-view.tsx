import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useScreenModel } from '../screens/v2/data.js';
import { ProblemAnalysisView } from '../screens/v2/problem-analysis/View.js';
import { useNav } from '../screens/v2/nav.js';
import { ScreenStates } from '../ui/v2/screen-states.js';
import { previewProvider } from './v2-preview.js';

/** The v2 Problem Analysis as a screen will run it: the model through the shared seam, the load states from the kit in the same shell. */
export default function V2ProblemAnalysisView() {
  const [params] = useSearchParams();
  const provider = useMemo(
    () => previewProvider<'problem-analysis'>(params.get('state')),
    [params],
  );
  const loaded = useScreenModel('problem-analysis', {}, provider);
  const nav = useNav('problems');
  const { t } = useTranslation();
  const title = t('v2p.pa.title');
  if (loaded.state !== 'ready' || !loaded.model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  return <ProblemAnalysisView model={loaded.model} nav={nav} title={title} />;
}
