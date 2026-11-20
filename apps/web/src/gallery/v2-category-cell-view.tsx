import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useScreenModel } from '../screens/v2/data.js';
import { CategoryCellView } from '../screens/v2/category-cell/View.js';
import { useNav } from '../screens/v2/nav.js';
import { ScreenStates } from '../ui/v2/screen-states.js';
import { previewProvider } from './v2-preview.js';

/** The v2 category-cell screen as it will run: the model through the shared seam, the load states from the kit in the same shell. */
export default function V2CategoryCellView() {
  const [params] = useSearchParams();
  const provider = useMemo(() => previewProvider<'category-cell'>(params.get('state')), [params]);
  const loaded = useScreenModel('category-cell', {}, provider);
  const nav = useNav('reliability');
  const { t } = useTranslation();
  const title = t('v2r.cc.title');
  if (loaded.state !== 'ready' || !loaded.model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  return <CategoryCellView model={loaded.model} nav={nav} title={title} />;
}
