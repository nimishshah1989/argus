import { useScreenModel } from '../data.js';
import { ScreenStates } from '../../../ui/v2/screen-states.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { EntityShell } from '../entity/EntityShell.js';
import { DashboardView } from './View.js';

/** The live Dashboard: the engine's figures and the desk's state, through the shared live source. */
export function DashboardPage({ nav, title }: { nav: NavItem[]; title: string }) {
  const loaded = useScreenModel('dashboard', {});
  if (loaded.state === 'ready' && loaded.model)
    return <DashboardView model={loaded.model} nav={nav} title={title} />;
  return (
    <EntityShell nav={nav} title={title}>
      <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
    </EntityShell>
  );
}
