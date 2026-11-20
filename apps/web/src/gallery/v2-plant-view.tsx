import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNav } from '../screens/v2/nav.js';
import { PlantDemo } from '../screens/v2/fixtures/PlantDemo.js';
import { dashboardFixture } from '../screens/v2/fixtures/plant-fixture.js';
import { toggled } from './v2-preview.js';

/**
 * A kit demo, not a screen: the plant map, the decision list, the machine table, the targets and the Pareto with
 * their actions, on invented data, so each kit part and the entity drawer stay under test while no live screen uses them.
 */
export default function V2PlantView() {
  const nav = useNav('today');
  const { t } = useTranslation();
  const [decided, setDecided] = useState<ReadonlySet<string>>(new Set());
  return (
    <PlantDemo
      model={{
        ...dashboardFixture,
        decisions: dashboardFixture.decisions.map((d) => ({ ...d, decided: decided.has(d.id) })),
      }}
      nav={nav}
      title={t('analytics.screen.dashboard')}
      onDecide={(id) => setDecided((was) => toggled(was, id, true))}
      onUndo={(id) => setDecided((was) => toggled(was, id, false))}
    />
  );
}
