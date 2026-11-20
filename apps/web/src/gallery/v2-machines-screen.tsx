import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { FiguresReply } from '@uptimo/shared/analytics';
import type { NavItem } from '../ui/v2/shell.js';
import { ScreenStates } from '../ui/v2/screen-states.js';
import { catalogue } from '../screens/v2/figures/live.js';
import type { Translate } from '../screens/v2/figures/read.js';
import { useScreenModel, type ScreenKey, type ScreenModel } from '../screens/v2/data.js';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useNav } from '../screens/v2/nav.js';
import { previewProvider } from './v2-preview.js';
import { machinesReply } from './v2-machines-reply.js';

/** Who is looking: `&role=` in the address (a head by default), so the gallery shows what each login is allowed to see. */
export type Viewer = { role: string };

/**
 * One Machines screen in the gallery: its model through the shared seam, built by its own adapter from the answer
 * key's reply, with `&state=loading|empty|error` and `&role=` to preview the states and the roles.
 */
export function MachinesScreen<K extends ScreenKey>({
  screen,
  title,
  build,
  children,
}: {
  screen: K;
  title: string;
  build: (reply: FiguresReply, t: Translate, viewer: Viewer) => ScreenModel<K> | null;
  children: (
    model: ScreenModel<K>,
    shell: { nav: NavItem[]; title: string },
    viewer: Viewer,
  ) => ReactNode;
}) {
  const [params] = useSearchParams();
  const state = params.get('state');
  const viewer = useMemo<Viewer>(() => ({ role: params.get('role') ?? 'head' }), [params]);
  const provider = useMemo(
    () =>
      previewProvider<K>(state) ??
      (() => Promise.resolve(build(machinesReply(), catalogue, viewer))),
    [state, viewer, build],
  );
  const loaded = useScreenModel(screen, {} as never, provider as never);
  const nav = useNav('machines');
  const { t } = useTranslation();
  const heading = t(title);
  if (loaded.state !== 'ready' || !loaded.model)
    return (
      <EntityShell nav={nav} title={heading}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  return children(loaded.model as ScreenModel<K>, { nav, title: heading }, viewer);
}
