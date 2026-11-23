import { useContext, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { DrillOpenContext } from '../../../ui/v2/drill.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { fixTarget } from './live.js';
import type { DataChecklistModel } from './model.js';
import { DataChecklistView } from './View.js';

/**
 * The live Data Checklist inside `ModelPage` (DC-2, ticket 578): `DataChecklistView` with each check's fix button wired by
 * `fixTarget(checkId, model.drill)` — a drill opens through `DrillOpenContext`, a path through `useNavigate()`. No Undo
 * (nothing stores a fix, ADR 0017 (e)).
 */
export function DataChecklistLive({
  model,
  nav,
  title,
}: {
  model: DataChecklistModel;
  nav: NavItem[];
  title: string;
}): ReactElement {
  const openDrill = useContext(DrillOpenContext);
  const navigate = useNavigate();
  return (
    <DataChecklistView
      model={model}
      nav={nav}
      title={title}
      onFix={(id) => {
        const target = fixTarget(id, model.drill);
        if ('drill' in target) openDrill(target.drill);
        else navigate(target.to);
      }}
    />
  );
}
