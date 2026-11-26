/* eslint-disable i18next/no-literal-string -- typed keys only; every visible word comes from the model */
import { DataTable, type Column } from '../../../ui/v2/data-table.js';
import { EntityChip } from '../../../ui/v2/entity-chip.js';
import { ReasonChips } from '../../../ui/v2/reason-chip.js';
import type { ActionCenterModel, RiskRow } from './model.js';
import { riskReasons } from './sweep.js';

const columns = (
  words: ActionCenterModel['words']['risk'],
  labels: string[],
): Column<RiskRow>[] => [
  {
    key: 'machine',
    label: words.machine,
    sortBy: (r) => r.machine?.label ?? '',
    cell: (r) => (
      <div className="v2-row v2-gap-8">
        {r.machine ? <EntityChip {...r.machine} /> : null}
        <span className="v2-sub">{r.model}</span>
      </div>
    ),
  },
  {
    key: 'score',
    label: words.score,
    numeric: true,
    sortBy: (r) => r.score.value,
    cell: (r) => r.score.shown,
  },
  {
    key: 'why',
    label: words.why,
    sortBy: (r) => r.why,
    cell: (r) => <ReasonChips reasons={riskReasons(r.why, labels)} />,
  },
];

/** "Machines needing attention": the engine's top machines by open nudges, its score and the rules that fired. */
export function RiskTable({ model }: { model: ActionCenterModel }) {
  const { risk } = model.words;
  return (
    <DataTable
      rows={model.risk}
      rowKey={(r) => r.text}
      rowLabel={(r) => `${r.machine?.label ?? ''} ${r.model}`.trim()}
      columns={columns(
        risk,
        model.types.map((x) => x.label),
      )}
      filters={[]}
      text={(r) => r.text}
      words={risk.table}
      initialSort={{ key: 'score', dir: 'desc' }}
    />
  );
}
