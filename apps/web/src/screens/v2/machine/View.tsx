import { useState } from 'react';
import { EntityChip } from '../../../ui/v2/entity-chip.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { cellChip, machineChip, STATE_ICON, STATE_TONE } from '../../../ui/v2/domain/plant.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { KpiCard } from '../../../ui/v2/kpi-card.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { TrendChart } from '../../../ui/v2/trend-chart.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { NextCard, PmCard, SparesCard } from './Cards.js';
import { History } from './History.js';
import type { MachinePageModel } from './model.js';

const ignore = () => {};

/** Who the machine is and where it stands, in one line: its state, its code, its name, its type and its cell. */
function Identity({ model }: { model: MachinePageModel }) {
  const m = model.machine;
  return (
    <div className="v2-row v2-gap-8">
      <KeyPill
        text={model.words.states[m.state]}
        tone={STATE_TONE[m.state]}
        icon={STATE_ICON[m.state]}
      />
      <EntityChip {...machineChip(m)} />
      <span className="v2-sub">
        {m.typeLabel} · <EntityChip {...cellChip(m.cell)} />
      </span>
    </div>
  );
}

/**
 * One machine's own page, decision-first: its state and why, four key figures, what to do next, the 12-week trend
 * beside its PM and spares, and every breakdown of the year as a table whose row opens its story. Any chip on the
 * page (the machine, its cell, a person) opens that thing in the drawer, which lives in the URL.
 */
export function MachineView({
  model,
  nav,
  title,
  onAct = ignore,
  onUndo = ignore,
}: {
  model: MachinePageModel;
  nav: NavItem[];
  title: string;
  onAct?: () => void;
  onUndo?: () => void;
}) {
  const { words } = model;
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState<string>();
  return (
    <EntityShell nav={nav} title={title}>
      <Identity model={model} />
      <Verdict verdict={model.verdict} whyLabel={words.why} />
      <Row cols={4}>
        {model.kpis.map((k) => (
          <KpiCard key={k.id} kpi={k} />
        ))}
      </Row>
      <NextCard
        next={model.next}
        words={words}
        done={done}
        onAct={() => (setDone(true), onAct())}
        onUndo={() => (setDone(false), onUndo())}
      />
      <Row wide>
        <TrendChart data={model.trend} />
        <div className="v2-stack">
          <PmCard pm={model.pm} title={words.pmTitle} />
          <SparesCard spares={model.spares} title={words.sparesTitle} />
        </div>
      </Row>
      <History rows={model.history} words={words.history} open={open} onOpen={setOpen} />
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
