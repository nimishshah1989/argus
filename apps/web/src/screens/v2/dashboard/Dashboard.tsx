import { useState } from 'react';
import { BulletBar } from '../../../ui/v2/bullet-bar.js';
import { DecisionRow } from '../../../ui/v2/decision-row.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Pareto } from '../../../ui/v2/pareto.js';
import { PlantMap } from '../../../ui/v2/plant-map.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import type { DashboardActions, DashboardModel, DashboardWords } from './model.js';

function Decisions({ model, onDecide }: { model: DashboardModel } & DashboardActions) {
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const { words, decisions } = model;
  const act = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      onDecide?.(id);
    }
    setDone(next);
  };
  const count = done.size
    ? words.decideDone
        .replace('{n}', String(done.size))
        .replace('{total}', String(decisions.length))
    : words.decideWaiting.replace('{n}', String(decisions.length));
  return (
    <Panel
      id="v2-decide"
      title={words.decideTitle}
      inset
      aside={<span className="v2-note v2-num">{count}</span>}
    >
      {decisions.map((d) => (
        <DecisionRow key={d.id} d={d} words={words} done={done.has(d.id)} onAct={() => act(d.id)} />
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
        <Decisions model={model} onDecide={actions.onDecide} />
        <div className="v2-two">
          <PlantMap cells={model.cells} words={words.plant} />
          <Panel id="v2-target" title={words.targetTitle}>
            {model.bullets.map((b) => (
              <BulletBar key={b.id} b={b} />
            ))}
            <Legend legend={words.legend} />
          </Panel>
        </div>
        <Panel id="v2-pareto" title={words.paretoTitle}>
          <Pareto data={model.pareto} whyLabel={words.whyThese} actions={buttons} />
        </Panel>
      </div>
    </main>
  );
}
