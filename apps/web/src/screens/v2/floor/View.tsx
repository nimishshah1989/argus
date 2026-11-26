/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible word comes from the model */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CirclePlus, List, Wrench } from '../../../ui/icon.js';
import { useSystemTheme } from '../../../ui/system-theme.js';
import { AccountButton, AccountSheet } from '../../../ui/v2/account-sheet.js';
import { BottomSheet } from '../../../ui/v2/bottom-sheet.js';
import { DraftsList } from '../../../ui/v2/drafts-list.js';
import { FloorPanel, FloorStates, FloorTabs, Line } from '../../../ui/v2/floor-kit.js';
import { Skeleton } from '../../../ui/v2/screen-states.js';
import { Wizard, type WizardStep } from '../../../ui/v2/wizard.js';
import type {
  FloorTabKey,
  FloorWaiting,
  ReportModel,
  TabsModel,
  TicketSheetModel,
} from './model.js';
import {
  MachineStepBody,
  FactsCard,
  situationStep,
  problemStep,
  SentView,
} from './report-steps.js';
export { SentView } from './report-steps.js';
export { type OtherWorkActions, OtherWorkView } from './other-work.js';

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
