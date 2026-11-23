import type { ReactElement } from 'react';
import type { NavItem } from '../../../ui/v2/shell.js';
import type { DataChecklistModel } from './model.js';

/**
 * The live Data Checklist inside `ModelPage` (DC-2, #578): `DataChecklistView` with each check's fix button wired by
 * `fixTarget(checkId, model.drill)` — a drill opens through `DrillOpenContext`, a path through `useNavigate()`. No Undo
 * (nothing stores a fix, ADR 0017 (e)).
 */
export function DataChecklistLive(props: {
  model: DataChecklistModel;
  nav: NavItem[];
  title: string;
}): ReactElement {
  void props;
  throw new Error('not built: DC-2 DataChecklistLive (#578)');
}
