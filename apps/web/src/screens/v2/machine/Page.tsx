import { useTranslation } from 'react-i18next';
import { ScreenStates } from '../../../ui/v2/screen-states.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { useScreenModel } from '../data.js';
import { EntityShell } from '../entity/EntityShell.js';
import { MachineView } from './View.js';

/** The live Machine page for the route's machine: its engine figures, its open tickets and the plant's list. */
export function MachinePage({ id, nav }: { id: string; nav: NavItem[] }) {
  const { t } = useTranslation();
  const loaded = useScreenModel('machine', { id });
  if (loaded.state === 'ready' && loaded.model)
    return <MachineView model={loaded.model} nav={nav} title={loaded.model.machine.code} />;
  return (
    <EntityShell nav={nav} title={t('analytics.machine.title')}>
      <ScreenStates loaded={loaded} emptyText={t('analytics.machine.noRecord')}>
        {() => null}
      </ScreenStates>
    </EntityShell>
  );
}
