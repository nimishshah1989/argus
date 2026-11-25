/* eslint-disable i18next/no-literal-string -- typed keys only; every visible word comes from the model */
import { Link } from 'react-router-dom';
import { Button } from '../../../ui/v2/button.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { EngineTable } from '../../../ui/v2/domain/engine-table.js';
import { FactList } from '../../../ui/v2/domain/fact-list.js';
import { DrillOpenContext, type Drill } from '../../../ui/v2/drill.js';
import { EntityChip } from '../../../ui/v2/entity-chip.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { KpiCard } from '../../../ui/v2/kpi-card.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Row } from '../../../ui/v2/row.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useContext } from 'react';
import type { FitModel, MachinePageModel, TaskRow } from './model.js';

/** The way to the rows behind a block, in the block's head. */
function SeeRows({ drill, label }: { drill?: Drill; label: string }) {
  const open = useContext(DrillOpenContext);
  return drill ? <Button onClick={() => open(drill)}>{label}</Button> : null;
}

/** Who the machine is, in one line: its code, its type and its cell. */
function Identity({ model }: { model: MachinePageModel }) {
  const { machine } = model;
  return (
    <div className="v2-row v2-gap-8">
      <EntityChip {...machine.chip} />
      <span className="v2-sub">{machine.type}</span>
      {machine.cell ? <EntityChip {...machine.cell} /> : null}
    </div>
  );
}

function Fit({ fit }: { fit: FitModel }) {
  return (
    <div className="v2-stack v2-gap-8">
      {fit.heading ? <h3 className="v2-h3">{fit.heading}</h3> : null}
      {fit.figures.length > 0 ? <FactList facts={fit.figures} /> : null}
      {fit.lines.map((line) => (
        <p key={line} className="v2-sub">
          {line}
        </p>
      ))}
      {fit.trend ? (
        <p className="v2-sub">
          <strong>{fit.trend.word}</strong> <span>{fit.trend.slope}</span>
        </p>
      ) : null}
    </div>
  );
}

function Task({ row }: { row: TaskRow }) {
  return (
    <li className="v2-item">
      <div className="v2-row v2-gap-8">
        <Link to={row.href} className="v2-link">
          {row.ref}
        </Link>
        <KeyPill text={row.status} tone="neutral" />
        {row.overdue ? <KeyPill text={row.overdue} tone="loss" icon="alert" /> : null}
      </div>
      <p>{row.problem}</p>
      {row.scheduled ? <p className="v2-sub">{row.scheduled}</p> : null}
    </li>
  );
}

function TaskList({ title, empty, rows }: { title: string; empty: string; rows: TaskRow[] }) {
  return (
    <div className="v2-stack">
      <h3 className="v2-h3">{title}</h3>
      {rows.length === 0 ? (
        <p className="v2-sub">{empty}</p>
      ) : (
        <ul className="v2-list">
          {rows.map((row) => (
            <Task key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One machine's page on the engine's own figures: its state of health in one sentence, the eight headline figures
 * (each opening its rows), what has gone wrong, how it is likely to, the parts it uses, what is open on it, where it has
 * been, what it is and how complete its record is. A chip opens that thing in the drawer, which lives in the URL.
 */
export function MachineView({
  model,
  nav,
  title,
}: {
  model: MachinePageModel;
  nav: NavItem[];
  title: string;
}) {
  const { words } = model;
  return (
    <EntityShell nav={nav} title={title}>
      <Identity model={model} />
      <Verdict verdict={model.verdict} whyLabel={words.why} />
      <Row cols={4}>
        {model.kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </Row>
      <Health model={model} />
      <Record model={model} />
      <SourceLine text={model.source} />
    </EntityShell>
  );
}

/** What has gone wrong, how it is likely to, the parts it uses and what is open on it. */
function Health({ model }: { model: MachinePageModel }) {
  const rows = (drill?: Drill) => <SeeRows drill={drill} label={model.words.seeRows} />;
  const { 'machine.spares': spares, 'machine.tasks': tasks } = model.takeaways;
  return (
    <>
      <Panel title={model.breakdowns.title} aside={rows(model.breakdowns.drill)}>
        <FactList facts={model.breakdowns.facts} />
      </Panel>
      <Row>
        <Panel title={model.reliability.title} aside={rows(model.reliability.drill)}>
          {model.reliability.fit ? (
            <Fit fit={model.reliability.fit} />
          ) : (
            <p className="v2-sub">{model.reliability.note}</p>
          )}
        </Panel>
        <Panel title={model.spares.title} aside={rows(model.spares.drill)}>
          {model.spares.table ? (
            <>
              <p className="v2-sub">{model.spares.ranked}</p>
              <EngineTable table={model.spares.table} />
              {model.spares.topLine ? <p className="v2-sub">{model.spares.topLine}</p> : null}
            </>
          ) : (
            // with a table, the table draws its own takeaway from its declared measure; without one, the takeaway carries the note
            spares && <Takeaway data={spares} />
          )}
        </Panel>
      </Row>
      <Panel title={model.tasks.title} sub={model.tasks.asOf}>
        {tasks ? <Takeaway data={tasks} /> : null}
        {/* unreadable tickets: the takeaway already says so */}
        {model.tasks.unavailable ? null : (
          <Row>
            <TaskList {...model.tasks.open} />
            <TaskList {...model.tasks.pm} />
          </Row>
        )}
      </Panel>
    </>
  );
}

/** Where the machine has been, what it is, its PM and how complete its record is. */
function Record({ model }: { model: MachinePageModel }) {
  const rows = (drill?: Drill) => <SeeRows drill={drill} label={model.words.seeRows} />;
  return (
    <>
      <Panel title={model.moves.title} aside={rows(model.moves.drill)}>
        {model.moves.table ? (
          <EngineTable table={model.moves.table} />
        ) : (
          <p className="v2-sub">{model.moves.none}</p>
        )}
      </Panel>
      <Row>
        <Panel title={model.nameplate.title} aside={rows(model.nameplate.drill)}>
          {model.nameplate.facts.length > 0 ? (
            <FactList facts={model.nameplate.facts} />
          ) : (
            <p className="v2-sub">{model.nameplate.none}</p>
          )}
        </Panel>
        <div className="v2-stack">
          <Panel title={model.pm.title} aside={rows(model.pm.drill)}>
            <FactList facts={model.pm.facts} />
          </Panel>
          <Panel title={model.completeness.title}>
            <FactList facts={[model.completeness.fact]} />
          </Panel>
        </div>
      </Row>
    </>
  );
}
