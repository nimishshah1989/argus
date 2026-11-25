import type { ReactNode } from 'react';
import type {
  FloorWaiting,
  OtherWorkForm,
  OtherWorkModel,
  ReportModel,
  SentModel,
  TabsModel,
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

/**
 * The floor's frame on every floor route (T2's lists use it too): Account button first, Drafts ("Needs attention"),
 * the page, then the tab bar (`nav` named "Floor"); the Account sheet; the theme follows the phone (`useSystemTheme`).
 */
export function FloorFrame(_props: { tabs: TabsModel; children: ReactNode }): ReactNode {
  throw new Error('not implemented');
}

/** Before the data is in: the header and Step 1's skeleton, or "Could not load. Try again." / offline + Try again. */
export function FloorWaitingView(_props: {
  title: string;
  state: FloorWaiting;
  onRetry: () => void;
}): ReactNode {
  throw new Error('not implemented');
}

/** The report wizard (`h2` page title, `h3` step title, "Step N of 3"); Send blocked offline; the ticket sheet. */
export function ReportView(_props: { model: ReportModel; on: ReportActions }): ReactNode {
  throw new Error('not implemented');
}

/** Sent: `h3` "Sent to maintenance", the stopped line, the facts card, Report another, See my complaints. */
export function SentView(_props: {
  model: SentModel;
  onAnother: () => void;
  onMine: () => void;
}): ReactNode {
  throw new Error('not implemented');
}

/** Other work: one wizard step titled "Other work (not a machine)", aside "Work request", back "Report". */
export function OtherWorkView(_props: { model: OtherWorkModel; on: OtherWorkActions }): ReactNode {
  throw new Error('not implemented');
}
