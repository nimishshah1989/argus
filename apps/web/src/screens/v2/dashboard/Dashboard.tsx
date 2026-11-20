import { fill } from '../../../i18n/fill.js';
import { BulletBar } from '../../../ui/v2/bullet-bar.js';
import { DecisionRow } from '../../../ui/v2/domain/decision-row.js';
import { PlantMap } from '../../../ui/v2/domain/plant-map.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Pareto } from '../../../ui/v2/pareto.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import type { DashboardActions, DashboardModel, DashboardWords } from './model.js';

const ignore = () => {};

function Decisions({
  model,
  onDecide = ignore,
  onUndo = ignore,
}: { model: DashboardModel } & DashboardActions) {
  const { words, decisions } = model;
  const decided = decisions.filter((d) => d.decided).length;
  const count = decided
    ? fill(words.decideDone, { n: decided, total: decisions.length })
    : fill(words.decideWaiting, { n: decisions.length });
  const aside = (
    <span className="v2-note v2-num" aria-live="polite" aria-atomic="true">
      {count}
    </span>
  );
  return (
    <Panel title={words.decideTitle} inset aside={aside}>
      {decisions.map((d) => (
        <DecisionRow key={d.id} d={d} words={words} onDecide={onDecide} onUndo={onUndo} />
      ))}
    </Panel>
  );
}

function Legend({ legend }: { legend: DashboardWords['legend'] }) {
  return (
    <div className="v2-legend v2-legend-bullet">
      <span className="v2-row v2-gap-6">
        <span className="v2-key-actual" aria-hidden="true" />
        {legend.actual}
      </span>
      <span className="v2-row v2-gap-6">
        <span className="v2-key-target" aria-hidden="true" />
        {legend.target}
      </span>
      <span className="v2-row v2-gap-6">
        <span className="v2-key-last" aria-hidden="true" />
        {legend.last}
      </span>
      <span className="v2-row v2-gap-6">
        <span className="v2-key-zone" aria-hidden="true" />
        {legend.zone}
      </span>
    </div>
  );
}

/** The decision-first Dashboard: verdict, decisions, the plant now, targets, and where the hours go. */
export function Dashboard({ model, ...actions }: { model: DashboardModel } & DashboardActions) {
  const { words } = model;
  const buttons = (
    <>
      <button type="button" className="v2-btn v2-btn-primary" onClick={actions.onAddFocus}>
        {words.addFocus}
      </button>
      <button type="button" className="v2-btn v2-btn-ghost" onClick={actions.onSeeFixes}>
        {words.seeFixes}
      </button>
    </>
  );
  return (
    <main className="v2-page">
      <div className="v2-col">
        <Verdict verdict={model.verdict} whyLabel={words.why} />
        <Decisions model={model} onDecide={actions.onDecide} onUndo={actions.onUndo} />
        <div className="v2-two">
          <PlantMap cells={model.cells} words={words.plant} />
          <Panel title={words.targetTitle}>
            {model.bullets.map((b) => (
              <BulletBar key={b.id} b={b} />
            ))}
            <Legend legend={words.legend} />
          </Panel>
        </div>
        <Panel title={words.paretoTitle}>
          <Pareto data={model.pareto} whyLabel={words.whyThese} actions={buttons} />
        </Panel>
      </div>
    </main>
  );
}
