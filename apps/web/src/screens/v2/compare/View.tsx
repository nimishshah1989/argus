import { Button } from '../../../ui/v2/button.js';
import { CompareBox } from '../../../ui/v2/domain/compare-box.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { PrintedDataTable } from '../../../ui/v2/domain/printed-table.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { KpiCard } from '../../../ui/v2/kpi-card.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Points } from '../../../ui/v2/points.js';
import { Row } from '../../../ui/v2/row.js';
import { Segmented } from '../../../ui/v2/segmented.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { TrendChart } from '../../../ui/v2/trend-chart.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import type { CompareActions, CompareModel } from './model.js';

const ignore = () => {};

/** Which two machines: one choice for each side; picking the other side's machine swaps them. */
function Pickers({
  model,
  onPick,
}: {
  model: CompareModel;
  onPick: Required<CompareActions>['onPick'];
}) {
  const { pick, words } = model;
  return (
    <div className="v2-row v2-gap-12">
      <div className="v2-row v2-gap-8">
        <span className="v2-sub">{words.pickA}</span>
        <Segmented
          label={words.pickA}
          options={pick.options}
          value={pick.a}
          onChange={(a) => onPick(a === pick.b ? { a, b: pick.a } : { a, b: pick.b })}
        />
      </div>
      <div className="v2-row v2-gap-8">
        <span className="v2-sub">{words.pickB}</span>
        <Segmented
          label={words.pickB}
          options={pick.options}
          value={pick.b}
          onChange={(b) => onPick(b === pick.a ? { a: pick.b, b } : { a: pick.a, b })}
        />
      </div>
    </div>
  );
}

/** What differs beneath the figures, ending in the one action that closes the gap. */
function Differences({ model, onAddFocus }: { model: CompareModel; onAddFocus: () => void }) {
  const d = model.differences;
  return (
    <Panel title={d.title}>
      <Points points={d.points} />
      {d.done ? (
        // eslint-disable-next-line i18next/no-literal-string -- a tone and an icon name, not copy
        <KeyPill text={d.doneText} tone="gain" icon="check" />
      ) : (
        <div>
          <Button primary onClick={onAddFocus}>
            {d.action}
          </Button>
        </div>
      )}
    </Panel>
  );
}

/**
 * The decision-first Compare: the verdict, which two machines, how far apart they are, their figures in two aligned
 * boxes with the biggest difference first, what differs beneath, and the weeks side by side. Every machine and cell
 * is a chip that opens its detail in the drawer, which lives in the URL.
 */
export function CompareView({
  model,
  nav,
  title,
  onPick = ignore,
  onAddFocus = ignore,
}: { model: CompareModel; nav: NavItem[]; title: string } & CompareActions) {
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      <Pickers model={model} onPick={onPick} />
      <Row cols={3}>
        {model.kpis.map((k) => (
          <KpiCard key={k.id} kpi={k} />
        ))}
      </Row>
      <Row>
        <CompareBox box={model.boxes[0]} />
        <CompareBox box={model.boxes[1]} />
      </Row>
      <Row wide>
        <Differences model={model} onAddFocus={onAddFocus} />
        <TrendChart data={model.trend} />
      </Row>
      {/* Ticket 586: v1's six tables, whole; a gallery model without them draws none */}
      {model.tables?.items.map((table, at) => (
        <PrintedDataTable key={`${table.title}-${at}`} table={table} words={model.tables!.words} />
      ))}
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
