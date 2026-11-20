import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { CompareView } from '../screens/v2/compare/View.js';
import { DEFAULT_PAIR } from '../screens/v2/compare/fixture.js';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useScreenModel } from '../screens/v2/data.js';
import { useNav } from '../screens/v2/nav.js';
import { ScreenStates } from '../ui/v2/screen-states.js';
import { previewProvider } from './v2-preview.js';

/** The address parameters that name the pair. */
const KEY = { a: 'a', b: 'b' } as const;

/**
 * The v2 Compare as a screen will run it: the model through the shared seam, asked for the pair in the address
 * (`&a=VC-67&b=VC-18`), the load states from the kit inside the same shell, and this view standing in for the server
 * on which fix is added to Team Focus.
 */
export default function V2CompareView() {
  const [params, setParams] = useSearchParams();
  const state = params.get('state');
  const pair = { a: params.get(KEY.a) ?? DEFAULT_PAIR.a, b: params.get(KEY.b) ?? DEFAULT_PAIR.b };
  const provider = useMemo(() => previewProvider<'compare'>(state), [state]);
  const loaded = useScreenModel('compare', pair, provider);
  const nav = useNav('machines');
  const { t } = useTranslation();
  const title = t('ashell.v2.compare');
  const [added, setAdded] = useState(false);
  if (loaded.state !== 'ready' || !loaded.model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  const model = loaded.model;
  return (
    <CompareView
      model={{ ...model, differences: { ...model.differences, done: added } }}
      nav={nav}
      title={title}
      onPick={(next) =>
        setParams(
          (was) => {
            const p = new URLSearchParams(was);
            p.set(KEY.a, next.a);
            p.set(KEY.b, next.b);
            return p;
          },
          { replace: true },
        )
      }
      onAddFocus={() => setAdded(true)}
    />
  );
}
