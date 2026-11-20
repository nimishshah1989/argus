import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useNav } from '../screens/v2/nav.js';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useScreenModel, type Provider } from '../screens/v2/data.js';
import { MachineView } from '../screens/v2/machine/View.js';
import { ScreenStates } from '../ui/v2/screen-states.js';

/** The machine the gallery opens when none is asked for. */
const DEFAULT_MACHINE = 'VC-67';

/** Providers that show each load state in the gallery: `&state=loading`, `empty` or `error`. */
function previewProvider(state: string | null): Provider<'machine'> | undefined {
  if (state === 'loading') return () => new Promise(() => {});
  if (state === 'empty') return () => Promise.resolve(null);
  if (state === 'error') return () => Promise.reject(new Error('preview'));
  return undefined;
}

/**
 * The v2 Machine page as a screen will run it: the model through the shared seam (`useScreenModel`), the load
 * states and the "not found" for a code the plant does not have from the kit, inside the same shell.
 * `?id=` picks the machine, any one on the Dashboard.
 */
export default function V2MachineView() {
  const [params] = useSearchParams();
  const id = params.get('id') ?? DEFAULT_MACHINE;
  const state = params.get('state');
  const provider = useMemo(() => previewProvider(state), [state]);
  const loaded = useScreenModel('machine', { id }, provider);
  const nav = useNav('machines');
  const { t } = useTranslation();
  const title = loaded.model?.machine.name ?? t('analytics.machine.title');
  if (loaded.state !== 'ready' || !loaded.model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded} emptyText={t('ashell.machine.notFound')}>
          {() => null}
        </ScreenStates>
      </EntityShell>
    );
  return <MachineView key={id} model={loaded.model} nav={nav} title={title} />;
}
