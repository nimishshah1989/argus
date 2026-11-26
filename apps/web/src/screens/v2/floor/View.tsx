/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible word comes from the model */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountButtonRow, AccountSheet } from '../../../components/AccountSheet.js';
import { Drafts } from '../../../components/Drafts.js';
import { PatternFrame, StateNotice } from '../../../patterns/frame.js';
import { WizardPage, type WizardStep } from '../../../patterns/wizard-page.js';
import { Banner } from '../../../ui/banner.js';
import { Button } from '../../../ui/button.js';
import {
  ChoiceCard,
  GroupSection,
  GroupTile,
  MachineCard,
  MachineRow,
  QuickChip,
} from '../../../ui/floor-pieces.js';
import { CirclePlus, LifeBuoy, List, OctagonX, Wrench } from '../../../ui/icon.js';
import { Checkbox, Input, Label, Select, Textarea } from '../../../ui/input.js';
import { Inline, Page, Shell, Stack } from '../../../ui/layout.js';
import { Loading, Skeleton } from '../../../ui/loading.js';
import { Sheet } from '../../../ui/sheet.js';
import { StatusPill } from '../../../ui/status/status-pill.js';
import { useSystemTheme } from '../../../ui/system-theme.js';
import { TabBar } from '../../../ui/tab-bar.js';
import { Text } from '../../../ui/text.js';
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
 * S27 Floor views (ADR 0045 T1). Draws the models and raises callbacks; no queries here. Reuses the token-styled
 * phone parts (decision 6b): `ui/tab-bar` `TabBar`, `patterns/wizard-page` `WizardPage`, `ui/sheet` `Sheet`,
 * `ui/input`, `ui/floor-pieces`, `ui/status/status-pill`, `components/AccountSheet`, `components/Drafts`,
 * `patterns/frame`, `ui/loading`. Never `ui/v2/shell.tsx` (it draws an `h1`) and never an `EntityChip` (an extra
 * button breaks `e2e/gallery/floor-order-lists.ts`); a code goes in as a prop (`code={...}`), never as JSX text.
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
    <Shell
      bar={
        <TabBar
          label={p.tabs.label}
          tabs={tabs}
          current={tabs.find((tab) => tab.key === p.tabs.current)?.to ?? ''}
        />
      }
    >
      <Page>
        <AccountButtonRow onClick={() => setAccount(true)} />
        <Drafts />
        {p.children}
      </Page>
      <AccountSheet open={account} onOpenChange={setAccount} />
    </Shell>
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
    <PatternFrame title={p.title} quietOnline>
      {p.state === 'loading' ? (
        <Loading>
          <Stack gap={3}>
            <Skeleton shape="title" />
            <Skeleton shape="line" />
            <Skeleton shape="row" />
            <Skeleton shape="tile" />
            <Skeleton shape="tile" />
          </Stack>
        </Loading>
      ) : (
        <StateNotice state={p.state} empty={t('kit.pattern.error')} onRetry={p.onRetry} />
      )}
    </PatternFrame>
  );
}

function Rows(p: { rows: MachineRowModel[]; onPick: (id: string) => void }) {
  return (
    <Stack gap={2}>
      {p.rows.map((row) => (
        <MachineRow
          key={row.id}
          code={row.code}
          detail={row.detail}
          status={<StatusPill group="ticket" id={row.status} />}
          onClick={() => p.onPick(row.id)}
        />
      ))}
    </Stack>
  );
}

type StepBodyProps<M> = { machine: M; on: ReportActions; pick: (id: string) => void };

function GroupStepBody({ machine, on, pick }: StepBodyProps<GroupStepModel>) {
  return (
    <Stack gap={3}>
      <Stack gap={2}>
        <Label htmlFor="floor-machine-id">{machine.idLabel}</Label>
        <Input
          id="floor-machine-id"
          value={machine.query}
          placeholder={machine.placeholder}
          onChange={(e) => on.onQuery(e.target.value)}
        />
        <Text size="footnote" tone="secondary">
          {machine.hint}
        </Text>
      </Stack>
      <Rows rows={machine.rows} onPick={pick} />
    </Stack>
  );
}

function BrowseStepBody({ machine, on, pick }: StepBodyProps<BrowseModel>) {
  return (
    <Stack gap={3}>
      <Text tone="secondary">{machine.hint}</Text>
      <Stack gap={2}>
        <Label htmlFor="floor-find">{machine.findLabel}</Label>
        <Input
          id="floor-find"
          type="search"
          value={machine.query}
          placeholder={machine.findPlaceholder}
          onChange={(e) => on.onQuery(e.target.value)}
        />
      </Stack>
      {machine.other ? (
        <Stack gap={4}>
          {machine.recent.length > 0 ? (
            <Inline gap={2}>
              <Text size="footnote" tone="secondary" weight="bold">
                {machine.recentLabel}
              </Text>
              {machine.recent.map((m) => (
                <QuickChip key={m.id} label={m.code} onClick={() => pick(m.id)} />
              ))}
            </Inline>
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
        </Stack>
      ) : null}
      {machine.noMatch ? <Text tone="secondary">{machine.noMatch}</Text> : null}
      <Rows rows={machine.rows} onPick={pick} />
    </Stack>
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
    <Stack gap={4}>
      <MachineCard
        label={model.machine.label}
        code={model.machine.code}
        detail={model.machine.detail}
      />
      {model.support ? (
        <Banner tone="attention" title={model.support.title}>
          {model.support.text}
        </Banner>
      ) : null}
      {model.tasks ? (
        <Banner tone="attention" title={model.tasks.title}>
          <Stack gap={1}>
            {model.tasks.lines.map((line) => (
              <Text key={line} size="footnote">
                {line}
              </Text>
            ))}
          </Stack>
        </Banner>
      ) : null}
    </Stack>
  );
}

function Who(p: { who: WhoModel; onStartNow: (on: boolean) => void }) {
  if (p.who.kind === 'startNow')
    return (
      <Checkbox
        label={p.who.label}
        checked={p.who.checked}
        onChange={(e) => p.onStartNow(e.target.checked)}
      />
    );
  return (
    <Text size="footnote" tone="secondary">
      {p.who.text}
    </Text>
  );
}

function FactsCard({ facts }: { facts: TicketFactsModel }) {
  return (
    <MachineCard code={facts.place} status={<StatusPill group="ticket" id={facts.status} />}>
      <Text size="footnote" weight="bold">
        {facts.number}
      </Text>
      <Text>{facts.problem}</Text>
      <Text size="footnote" tone="secondary">
        {facts.reported}
      </Text>
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
        <Stack gap={3}>
          <ChoiceCard
            icon={OctagonX}
            tone="danger"
            title={situation.stopped.title}
            detail={situation.stopped.detail}
            onClick={() => on.onStopped(next)}
          />
          <ChoiceCard
            icon={LifeBuoy}
            tone="warning"
            title={situation.running.title}
            detail={situation.running.detail}
            onClick={() => on.onRunning(next)}
          />
        </Stack>
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
        <Text>{problem.upgradeText}</Text>
      ) : (
        <Stack gap={3}>
          <Textarea
            id="floor-problem"
            aria-label={problem.label}
            value={problem.problem}
            placeholder={problem.placeholder}
            onChange={(e) => on.onProblem(e.target.value)}
          />
          <Inline gap={2}>
            {problem.chips.map((chip) => (
              <QuickChip
                key={chip.id}
                label={chip.label}
                pressed={chip.pressed}
                onClick={() => on.onProblem(chip.label)}
              />
            ))}
          </Inline>
          <Who who={problem.who} onStartNow={on.onStartNow} />
        </Stack>
      ),
    action: problem.action,
    ready: problem.ready,
  };
}

/** The read-only ticket sheet: the open breakdown's facts and whether work has started. */
function TicketSheet(p: { sheet: TicketSheetModel | null; onClose: () => void }) {
  const { sheet } = p;
  return (
    <Sheet
      open={sheet !== null}
      onOpenChange={(open) => (open ? undefined : p.onClose())}
      title={sheet?.title ?? ''}
    >
      {sheet ? (
        <Stack gap={3}>
          <FactsCard facts={sheet.facts} />
          <Text size="footnote" tone="secondary">
            {sheet.started}
          </Text>
        </Stack>
      ) : null}
    </Sheet>
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
      <WizardPage
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
    <Stack gap={4}>
      <Stack gap={1}>
        <Text as="h3" size="title2" weight="bold">
          {model.title}
        </Text>
        {model.onLive ? <Text tone="secondary">{model.onLive}</Text> : null}
      </Stack>
      <FactsCard facts={model.facts} />
      <Button onClick={p.onAnother}>{model.another}</Button>
      <Button variant="quiet" onClick={p.onMine}>
        {model.seeMine}
      </Button>
    </Stack>
  );
}

function Urgency({ m, on }: { m: OtherWorkModel; on: OtherWorkActions }) {
  return (
    <Stack gap={2}>
      <Text size="footnote" weight="bold">
        {m.urgency.label}
      </Text>
      <Inline gap={2}>
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
      </Inline>
    </Stack>
  );
}

function OtherWorkBody({ m, on }: { m: OtherWorkModel; on: OtherWorkActions }) {
  return (
    <Stack gap={4}>
      <Stack gap={4}>
        <Text tone="secondary">{m.intro}</Text>
        <Stack gap={2}>
          <Label htmlFor="other-place">{m.where.label}</Label>
          <Select
            id="other-place"
            value={m.form.place}
            onChange={(e) => on.onForm({ place: e.target.value })}
          >
            <option value="">{m.where.choose}</option>
            {m.where.places.map((place) => (
              <option key={place}>{place}</option>
            ))}
          </Select>
          <Input
            aria-label={m.where.typedLabel}
            placeholder={m.where.typedLabel}
            value={m.form.typed}
            onChange={(e) => on.onForm({ typed: e.target.value })}
          />
        </Stack>
        <Stack gap={2}>
          <Label htmlFor="other-type">{m.workType.label}</Label>
          <Select
            id="other-type"
            value={m.form.workType}
            onChange={(e) => on.onForm({ workType: e.target.value })}
          >
            <option value="">{m.workType.choose}</option>
            {m.workType.types.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </Select>
        </Stack>
        <Stack gap={2}>
          <Label htmlFor="other-needed">{m.needed.label}</Label>
          <Textarea
            id="other-needed"
            placeholder={m.needed.placeholder}
            value={m.form.needed}
            onChange={(e) => on.onForm({ needed: e.target.value })}
          />
        </Stack>
        <Urgency m={m} on={on} />
      </Stack>
      <Who who={m.who} onStartNow={on.onStartNow} />
    </Stack>
  );
}

/** Other work: one wizard step titled "Other work (not a machine)", aside "Work request", back "Report". */
export function OtherWorkView(p: { model: OtherWorkModel; on: OtherWorkActions }): ReactNode {
  const { model: m, on } = p;
  return (
    <WizardPage
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
