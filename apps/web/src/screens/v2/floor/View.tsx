/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible word comes from the model */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CirclePlus, LifeBuoy, List, OctagonX, Wrench } from '../../../ui/icon.js';
import { useSystemTheme } from '../../../ui/system-theme.js';
import { AccountButton, AccountSheet } from '../../../ui/v2/account-sheet.js';
import { BottomSheet } from '../../../ui/v2/bottom-sheet.js';
import { Button } from '../../../ui/v2/button.js';
import { DraftsList } from '../../../ui/v2/drafts-list.js';
import {
  Actions,
  CheckRow,
  ChoiceCard,
  FieldLabel,
  FloorNote,
  FloorPanel,
  FloorStates,
  FloorTabs,
  GroupSection,
  GroupTile,
  Line,
  MachineCard,
  MachineRow,
  QuickChip,
  SelectBox,
  TextArea,
  TextInput,
} from '../../../ui/v2/floor-kit.js';
import { Skeleton } from '../../../ui/v2/screen-states.js';
import { StatusPill } from '../../../ui/v2/status-pill.js';
import { Wizard, type WizardStep } from '../../../ui/v2/wizard.js';
import type {
  BrowseModel,
  FloorTabKey,
  GroupStepModel,
  FloorWaiting,
  MachineRowModel,
  OtherWorkForm,
  OtherWorkModel,
  ProblemModel,
  ReportModel,
  SentModel,
  TabsModel,
  TicketFactsModel,
  TicketSheetModel,
  WhoModel,
} from './model.js';

/**
 * S27 Floor views (ADR 0045 T1, ADR 0055). Draws the models and raises callbacks; no queries here. Built from the
 * v2 kit's phone pieces: `ui/v2/floor-kit` (tabs, panel, rows, tiles, choices, chips, cards, fields),
 * `ui/v2/wizard`, `ui/v2/bottom-sheet`, `ui/v2/account-sheet`, `ui/v2/drafts-list`, `ui/v2/status-pill`. Never
 * `ui/v2/shell.tsx` (it draws an `h1`) and never an `EntityChip` (an extra button breaks
 * `e2e/gallery/floor-order-lists.ts`); a code goes in as a prop (`code={...}`), never as JSX text.
 */

/** What the report flow raises. A tap that moves the wizard on gets its `next`. */
export type ReportActions = {
  onQuery: (query: string) => void;
  /** A group tile (its id), or null for the header back "Groups". */
  onGroup: (groupId: string | null) => void;
  onPick: (machineId: string, next: () => void) => void;
  onOther: () => void;
  onStopped: (next: () => void) => void;
  onRunning: (next: () => void) => void;
  onProblem: (text: string) => void;
  onStartNow: (on: boolean) => void;
  /** The wizard's finish: a throw shows "Could not send. Try again.", `false` stays without an error. */
  onSend: () => Promise<void | false>;
  onCloseSheet: () => void;
  onAnother: () => void;
  onMine: () => void;
};

export type OtherWorkActions = {
  onForm: (patch: Partial<OtherWorkForm>) => void;
  onStartNow: (on: boolean) => void;
  onBack: () => void;
  onSend: () => Promise<void>;
  onAnother: () => void;
  onMine: () => void;
};

const TAB_ICONS = { report: CirclePlus, mine: List, pm: Wrench } satisfies Record<
  FloorTabKey,
  unknown
>;

/**
 * The floor's frame on every floor route (T2's lists use it too): Account button first, Drafts ("Needs attention"),
 * the page, then the tab bar (`nav` named "Floor"); the Account sheet; the theme follows the phone (`useSystemTheme`).
 */
export function FloorFrame(p: { tabs: TabsModel; children: ReactNode }): ReactNode {
  useSystemTheme();
  const [account, setAccount] = useState(false);
  const tabs = p.tabs.tabs.map((tab) => ({ ...tab, icon: TAB_ICONS[tab.key] }));
  return (
    <div className="v2-app v2-floor">
      <main className="v2-floor-page">
        <div className="v2-account-row-top">
          <AccountButton onClick={() => setAccount(true)} />
        </div>
        <DraftsList />
        {p.children}
      </main>
      <FloorTabs
        label={p.tabs.label}
        tabs={tabs}
        current={tabs.find((tab) => tab.key === p.tabs.current)?.to ?? ''}
      />
      <AccountSheet open={account} onOpenChange={setAccount} />
    </div>
  );
}

/** Before the data is in: the header and Step 1's skeleton, or "Could not load. Try again." / offline + Try again. */
export function FloorWaitingView(p: {
  title: string;
  state: FloorWaiting;
  onRetry: () => void;
}): ReactNode {
  const { t } = useTranslation();
  return (
    <FloorPanel title={p.title} quietOnline>
      {p.state === 'loading' ? (
        <Skeleton blocks={4} />
      ) : (
        <FloorStates state={p.state} empty={t('kit.pattern.error')} onRetry={p.onRetry} />
      )}
    </FloorPanel>
  );
}

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

function MachineStepBody(p: { model: ReportModel; on: ReportActions; next: () => void }) {
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

function Who(p: { who: WhoModel; onStartNow: (on: boolean) => void }) {
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

function FactsCard({ facts }: { facts: TicketFactsModel }) {
  return (
    <MachineCard code={facts.place} status={<StatusPill group="ticket" id={facts.status} />}>
      <Line strong>{facts.number}</Line>
      <Line>{facts.problem}</Line>
      <Line quiet>{facts.reported}</Line>
    </MachineCard>
  );
}

function situationStep(model: ReportModel, on: ReportActions): WizardStep {
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

function problemStep(problem: ProblemModel, on: ReportActions): WizardStep {
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

/** The read-only ticket sheet: the open breakdown's facts and whether work has started. */
function TicketSheet(p: { sheet: TicketSheetModel | null; onClose: () => void }) {
  const { sheet } = p;
  return (
    <BottomSheet
      open={sheet !== null}
      onOpenChange={(open) => (open ? undefined : p.onClose())}
      title={sheet?.title ?? ''}
    >
      {sheet ? (
        <div className="flex flex-col gap-3">
          <FactsCard facts={sheet.facts} />
          <Line quiet>{sheet.started}</Line>
        </div>
      ) : null}
    </BottomSheet>
  );
}

/** The report wizard (`h2` page title, `h3` step title, "Step N of 3"); Send blocked offline; the ticket sheet. */
export function ReportView(p: { model: ReportModel; on: ReportActions }): ReactNode {
  const { model, on } = p;
  const { machine } = model;
  const steps: WizardStep[] = [
    {
      title: machine.title,
      back: machine.kind === 'group' ? machine.back : undefined,
      onBack: machine.kind === 'group' ? () => on.onGroup(null) : undefined,
      body: (next) => <MachineStepBody model={model} on={on} next={next} />,
    },
    situationStep(model, on),
    problemStep(model.problem, on),
  ];
  return (
    <>
      <Wizard
        title={model.title}
        quietOnline
        steps={steps}
        start={model.start}
        offlineAllowed={false}
        onFinish={on.onSend}
        result={
          model.sent ? (
            <SentView model={model.sent} onAnother={on.onAnother} onMine={on.onMine} />
          ) : null
        }
      />
      <TicketSheet sheet={model.sheet} onClose={on.onCloseSheet} />
    </>
  );
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

function Urgency({ m, on }: { m: OtherWorkModel; on: OtherWorkActions }) {
  return (
    <div className="v2-floor-field-group">
      <span className="v2-floor-label">{m.urgency.label}</span>
      <div className="v2-floor-chips">
        <QuickChip
          label={m.urgency.normal}
          pressed={!m.form.urgent}
          onClick={() => on.onForm({ urgent: false })}
        />
        <QuickChip
          label={m.urgency.urgent}
          pressed={m.form.urgent}
          onClick={() => on.onForm({ urgent: true })}
        />
      </div>
    </div>
  );
}

function OtherWorkBody({ m, on }: { m: OtherWorkModel; on: OtherWorkActions }) {
  return (
    <div className="flex flex-col gap-4">
      <Line quiet>{m.intro}</Line>
      <div className="v2-floor-field-group">
        <FieldLabel htmlFor="other-place">{m.where.label}</FieldLabel>
        <SelectBox
          id="other-place"
          value={m.form.place}
          onChange={(e) => on.onForm({ place: e.target.value })}
        >
          <option value="">{m.where.choose}</option>
          {m.where.places.map((place) => (
            <option key={place}>{place}</option>
          ))}
        </SelectBox>
        <TextInput
          aria-label={m.where.typedLabel}
          placeholder={m.where.typedLabel}
          value={m.form.typed}
          onChange={(e) => on.onForm({ typed: e.target.value })}
        />
      </div>
      <div className="v2-floor-field-group">
        <FieldLabel htmlFor="other-type">{m.workType.label}</FieldLabel>
        <SelectBox
          id="other-type"
          value={m.form.workType}
          onChange={(e) => on.onForm({ workType: e.target.value })}
        >
          <option value="">{m.workType.choose}</option>
          {m.workType.types.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </SelectBox>
      </div>
      <div className="v2-floor-field-group">
        <FieldLabel htmlFor="other-needed">{m.needed.label}</FieldLabel>
        <TextArea
          id="other-needed"
          placeholder={m.needed.placeholder}
          value={m.form.needed}
          onChange={(e) => on.onForm({ needed: e.target.value })}
        />
      </div>
      <Urgency m={m} on={on} />
      <Who who={m.who} onStartNow={on.onStartNow} />
    </div>
  );
}

/** Other work: one wizard step titled "Other work (not a machine)", aside "Work request", back "Report". */
export function OtherWorkView(p: { model: OtherWorkModel; on: OtherWorkActions }): ReactNode {
  const { model: m, on } = p;
  return (
    <Wizard
      title={m.title}
      quietOnline
      aside={m.aside}
      steps={[
        {
          title: m.stepTitle,
          body: <OtherWorkBody m={m} on={on} />,
          back: m.back,
          onBack: on.onBack,
          action: m.action,
          ready: m.ready,
        },
      ]}
      offlineAllowed={false}
      onFinish={on.onSend}
      result={
        m.sent ? <SentView model={m.sent} onAnother={on.onAnother} onMine={on.onMine} /> : null
      }
    />
  );
}
