/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible word comes from the model */
import { type ReactNode } from 'react';
import { LifeBuoy, OctagonX, Wrench } from '../../../ui/icon.js';
import { Button } from '../../../ui/v2/button.js';
import {
  Actions,
  CheckRow,
  ChoiceCard,
  FieldLabel,
  FloorNote,
  GroupSection,
  GroupTile,
  Line,
  MachineCard,
  MachineRow,
  QuickChip,
  TextArea,
  TextInput,
} from '../../../ui/v2/floor-kit.js';
import { StatusPill } from '../../../ui/v2/status-pill.js';
import { type WizardStep } from '../../../ui/v2/wizard.js';
import type {
  BrowseModel,
  GroupStepModel,
  MachineRowModel,
  ProblemModel,
  ReportModel,
  SentModel,
  TicketFactsModel,
  WhoModel,
} from './model.js';
import type { ReportActions } from './View.js';

/** The report wizard's step bodies and the Sent card, drawn by `ReportView` (and by `OtherWorkView` for Sent). */

function Rows(p: { rows: MachineRowModel[]; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {p.rows.map((row) => (
        <MachineRow
          key={row.id}
          code={row.code}
          detail={row.detail}
          status={<StatusPill group="ticket" id={row.status} />}
          onClick={() => p.onPick(row.id)}
        />
      ))}
    </div>
  );
}

type StepBodyProps<M> = { machine: M; on: ReportActions; pick: (id: string) => void };

function GroupStepBody({ machine, on, pick }: StepBodyProps<GroupStepModel>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="v2-floor-field-group">
        <FieldLabel htmlFor="floor-machine-id">{machine.idLabel}</FieldLabel>
        <TextInput
          id="floor-machine-id"
          value={machine.query}
          placeholder={machine.placeholder}
          onChange={(e) => on.onQuery(e.target.value)}
        />
        <Line quiet>{machine.hint}</Line>
      </div>
      <Rows rows={machine.rows} onPick={pick} />
    </div>
  );
}

function BrowseStepBody({ machine, on, pick }: StepBodyProps<BrowseModel>) {
  return (
    <div className="flex flex-col gap-3">
      <Line quiet>{machine.hint}</Line>
      <div className="v2-floor-field-group">
        <FieldLabel htmlFor="floor-find">{machine.findLabel}</FieldLabel>
        <TextInput
          id="floor-find"
          type="search"
          value={machine.query}
          placeholder={machine.findPlaceholder}
          onChange={(e) => on.onQuery(e.target.value)}
        />
      </div>
      {machine.other ? (
        <div className="flex flex-col gap-4">
          {machine.recent.length > 0 ? (
            <div className="v2-floor-chips">
              <span className="v2-sub">{machine.recentLabel}</span>
              {machine.recent.map((m) => (
                <QuickChip key={m.id} label={m.code} onClick={() => pick(m.id)} />
              ))}
            </div>
          ) : null}
          <ChoiceCard
            icon={Wrench}
            tone="neutral"
            title={machine.other.title}
            detail={machine.other.detail}
            onClick={on.onOther}
          />
          {machine.segments.map((s) => (
            <GroupSection key={s.id} title={s.title} count={s.count}>
              {s.groups.map((g) => (
                <GroupTile
                  key={g.id}
                  code={g.code}
                  name={g.name}
                  count={g.count}
                  onClick={() => on.onGroup(g.id)}
                />
              ))}
            </GroupSection>
          ))}
        </div>
      ) : null}
      {machine.noMatch ? <Line quiet>{machine.noMatch}</Line> : null}
      <Rows rows={machine.rows} onPick={pick} />
    </div>
  );
}

export function MachineStepBody(p: { model: ReportModel; on: ReportActions; next: () => void }) {
  const { machine } = p.model;
  const pick = (id: string) => p.on.onPick(id, p.next);
  return machine.kind === 'group' ? (
    <GroupStepBody machine={machine} on={p.on} pick={pick} />
  ) : (
    <BrowseStepBody machine={machine} on={p.on} pick={pick} />
  );
}

function SituationLead({ model }: { model: NonNullable<ReportModel['situation']> }) {
  return (
    <div className="flex flex-col gap-4">
      <MachineCard
        label={model.machine.label}
        code={model.machine.code}
        detail={model.machine.detail}
      />
      {model.support ? (
        <FloorNote tone="risk" title={model.support.title}>
          {model.support.text}
        </FloorNote>
      ) : null}
      {model.tasks ? (
        <FloorNote tone="risk" title={model.tasks.title}>
          {model.tasks.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </FloorNote>
      ) : null}
    </div>
  );
}

export function Who(p: { who: WhoModel; onStartNow: (on: boolean) => void }) {
  if (p.who.kind === 'startNow')
    return (
      <CheckRow
        label={p.who.label}
        checked={p.who.checked}
        onChange={(e) => p.onStartNow(e.target.checked)}
      />
    );
  return <Line quiet>{p.who.text}</Line>;
}

export function FactsCard({ facts }: { facts: TicketFactsModel }) {
  return (
    <MachineCard code={facts.place} status={<StatusPill group="ticket" id={facts.status} />}>
      <Line strong>{facts.number}</Line>
      <Line>{facts.problem}</Line>
      <Line quiet>{facts.reported}</Line>
    </MachineCard>
  );
}

export function situationStep(model: ReportModel, on: ReportActions): WizardStep {
  const { situation } = model;
  return {
    title: situation?.title,
    back: situation?.back,
    lead: situation ? <SituationLead model={situation} /> : null,
    body: (next) =>
      situation ? (
        <div className="flex flex-col gap-3">
          <ChoiceCard
            icon={OctagonX}
            tone="loss"
            title={situation.stopped.title}
            detail={situation.stopped.detail}
            onClick={() => on.onStopped(next)}
          />
          <ChoiceCard
            icon={LifeBuoy}
            tone="risk"
            title={situation.running.title}
            detail={situation.running.detail}
            onClick={() => on.onRunning(next)}
          />
        </div>
      ) : null,
  };
}

export function problemStep(problem: ProblemModel, on: ReportActions): WizardStep {
  return {
    title: problem.title,
    back: problem.back,
    lead: (
      <MachineCard code={problem.code} status={<StatusPill group="ticket" id={problem.kind} />} />
    ),
    body:
      problem.upgradeText !== null ? (
        <Line>{problem.upgradeText}</Line>
      ) : (
        <div className="flex flex-col gap-3">
          <TextArea
            id="floor-problem"
            aria-label={problem.label}
            value={problem.problem}
            placeholder={problem.placeholder}
            onChange={(e) => on.onProblem(e.target.value)}
          />
          <div className="v2-floor-chips">
            {problem.chips.map((chip) => (
              <QuickChip
                key={chip.id}
                label={chip.label}
                pressed={chip.pressed}
                onClick={() => on.onProblem(chip.label)}
              />
            ))}
          </div>
          <Who who={problem.who} onStartNow={on.onStartNow} />
        </div>
      ),
    action: problem.action,
    ready: problem.ready,
  };
}

/** Sent: `h3` "Sent to maintenance", the stopped line, the facts card, Report another, See my complaints. */
export function SentView(p: {
  model: SentModel;
  onAnother: () => void;
  onMine: () => void;
}): ReactNode {
  const { model } = p;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="v2-floor-step">{model.title}</h3>
        {model.onLive ? <Line quiet>{model.onLive}</Line> : null}
      </div>
      <FactsCard facts={model.facts} />
      <Actions>
        <Button primary onClick={p.onAnother}>
          {model.another}
        </Button>
        <Button onClick={p.onMine}>{model.seeMine}</Button>
      </Actions>
    </div>
  );
}
