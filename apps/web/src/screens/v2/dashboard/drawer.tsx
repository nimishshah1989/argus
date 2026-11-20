import { DecisionDetail } from '../../../ui/v2/domain/decision-detail.js';
import { MachineDetail } from '../../../ui/v2/domain/machine-detail.js';
import type { DrawerSpec } from '../../../ui/v2/drawer.js';
import type { DashboardActions, DashboardModel } from './model.js';

export type Kind = 'decision' | 'machine';
/** What the drawer shows: one decision or one machine, or nothing. */
export type Selection = { kind: Kind; id: string } | null;
export type Acts = Required<DashboardActions>;

export /** The drawer for what is selected: a decision or a machine in full; null when nothing is. */
function drawerFor(
  model: DashboardModel,
  open: Selection,
  close: () => void,
  act: Acts,
): DrawerSpec | null {
  const { words, source } = model;
  if (open?.kind === 'decision') {
    const d = model.decisions.find((x) => x.id === open.id);
    if (!d) return null;
    const content = (
      <DecisionDetail
        d={d}
        words={words.decisionDetail}
        source={source}
        onDecide={act.onDecide}
        onUndo={act.onUndo}
      />
    );
    return { label: d.title, content, onClose: close };
  }
  const m = open && model.cells.flatMap((c) => c.machines).find((x) => x.code === open.id);
  if (!m) return null;
  return {
    label: m.name,
    content: <MachineDetail m={m} words={words.machineDetail} source={source} />,
    onClose: close,
  };
}
