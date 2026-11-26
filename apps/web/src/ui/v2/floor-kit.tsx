/* eslint-disable i18next/no-literal-string -- ARIA values and typed unions only; every visible word comes in as a prop or t() */
import { useId, type ComponentProps, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSyncStatus } from '../../data/index.js';
import type { ViewState } from '../../patterns/view-state.js';
import { ChevronLeft, ChevronRight, type IconComponent } from '../icon.js';
import { EmptyState, ErrorState, OfflineState, Skeleton } from './screen-states.js';
import { StatusPill } from './status-pill.js';

/**
 * The floor phone's pieces on the v2 kit (S27, ADR 0055): big tap targets (56 px and up), one column at 360 px,
 * every colour a v2 token (`floor.css`). The floor keeps its own frame (a tab bar, no rail), so these stand alone.
 */

/** The sync state, announced on change; on the floor (`quietOnline`) nothing shows while online. */
export function SyncLine({ quietOnline = false }: { quietOnline?: boolean }) {
  const id = useSyncStatus();
  return (
    <span role="status" data-testid="sync-status">
      {quietOnline && id === 'online' ? null : <StatusPill group="sync" id={id} />}
    </span>
  );
}

export type PanelBack = { label: string; onClick: () => void };

/**
 * One floor page: a section named by its `h2`. With `back` the header shows a back button in the title's place
 * (the title stays for screen readers); `aside` ("Step 1 of 3") sits beside the sync state.
 */
export function FloorPanel(p: {
  title: string;
  back?: PanelBack;
  aside?: string;
  quietOnline?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="v2-floor-panel">
      <div className="v2-floor-head">
        {p.back ? (
          <button type="button" className="v2-floor-back" onClick={p.back.onClick}>
            <ChevronLeft aria-hidden size={20} />
            {p.back.label}
          </button>
        ) : null}
        <h2 id={headingId} className={p.back ? 'sr-only' : 'v2-floor-title'}>
          {p.title}
        </h2>
        <span className="v2-floor-aside">
          {p.aside ? <span className="v2-sub">{p.aside}</span> : null}
          <SyncLine quietOnline={p.quietOnline} />
        </span>
      </div>
      {p.children}
    </section>
  );
}

/** A list that is not ready: loading blocks, nothing in it, offline or failed (both with Try again). */
export function FloorStates(p: {
  state: Exclude<ViewState, 'ready'>;
  empty: string;
  onRetry: () => void;
}) {
  if (p.state === 'loading') return <Skeleton blocks={3} />;
  if (p.state === 'empty') return <EmptyState text={p.empty} />;
  if (p.state === 'offline') return <OfflineState onRetry={p.onRetry} />;
  return <ErrorState onRetry={p.onRetry} />;
}

export type FloorTab = { to: string; label: string; icon: IconComponent; badge?: number };

/** The bottom tab bar (`nav`): the current tab is marked for screen readers and in the accent. */
export function FloorTabs(p: { label: string; tabs: FloorTab[]; current: string }) {
  return (
    <nav aria-label={p.label} className="v2-floor-tabs">
      {p.tabs.map(({ to, label, icon: TabIcon, badge }) => (
        <Link key={to} to={to} aria-current={to === p.current ? 'page' : undefined}>
          <span className="v2-floor-tab-icon">
            <TabIcon aria-hidden size={22} />
            {badge ? <span className="v2-floor-badge">{badge}</span> : null}
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** One machine in a search or group list: code, a detail line, its status on the right. */
export function MachineRow(p: {
  code: string;
  detail: string;
  status: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="v2-floor-tap v2-floor-row" onClick={p.onClick}>
      <span className="v2-floor-row-text">
        <span className="v2-floor-code">{p.code}</span>
        <span className="v2-sub">{p.detail}</span>
      </span>
      {p.status}
    </button>
  );
}

/** A segment heading with its machine count, then its group tiles two to a row. */
export function GroupSection(p: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="v2-floor-group">
      <h4 className="v2-floor-group-head">
        <span>{p.title}</span>
        <span className="v2-num">{p.count}</span>
      </h4>
      <div className="v2-floor-tiles">{p.children}</div>
    </section>
  );
}

/** A group of machines: short code in the accent, its name, how many machines. */
export function GroupTile(p: { code: string; name: string; count: string; onClick: () => void }) {
  return (
    <button type="button" className="v2-floor-tap v2-floor-tile" onClick={p.onClick}>
      <span className="v2-floor-tile-code">{p.code}</span>
      {p.name !== p.code ? <span>{p.name}</span> : null}
      <span className="v2-sub">{p.count}</span>
    </button>
  );
}

/** A big one-tap choice: a tinted icon, a bold title, one line of what it means. */
export function ChoiceCard(p: {
  icon: IconComponent;
  tone: 'loss' | 'risk' | 'neutral';
  title: string;
  detail: string;
  onClick: () => void;
}) {
  const ChoiceIcon = p.icon;
  return (
    <button
      type="button"
      className="v2-floor-tap v2-floor-choice"
      data-tone={p.tone}
      onClick={p.onClick}
    >
      <span className="v2-floor-choice-icon">
        <ChoiceIcon aria-hidden size={22} />
      </span>
      <span className="v2-floor-row-text">
        <span className="v2-floor-choice-title">{p.title}</span>
        <span className="v2-sub">{p.detail}</span>
      </span>
      <ChevronRight aria-hidden size={20} />
    </button>
  );
}

/** A round chip: a quick problem, a recent machine, a choice in a short set. 44 px to the finger. */
export function QuickChip(p: { label: string; pressed?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="v2-floor-chip" aria-pressed={p.pressed} onClick={p.onClick}>
      {p.label}
    </button>
  );
}

/** The machine (or ticket) a step is about: a small label, the code, its detail, a status pill, more lines. */
export function MachineCard(p: {
  code: string;
  label?: string;
  detail?: string;
  status?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="v2-card v2-floor-card">
      {p.label ? <span className="v2-sub">{p.label}</span> : null}
      <span className="v2-floor-card-head">
        <span className={p.label ? 'v2-floor-code-big' : 'v2-floor-code'}>{p.code}</span>
        {p.status}
      </span>
      {p.detail ? <span className="v2-sub">{p.detail}</span> : null}
      {p.children}
    </section>
  );
}

/** A note about this page with no link (a banner without the way in): `risk` to watch, `loss` when it failed. */
export function FloorNote(p: {
  tone: 'risk' | 'loss' | 'plan';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role={p.tone === 'loss' ? 'alert' : 'status'}
      className="v2-card v2-floor-note"
      data-tone={p.tone}
    >
      <p className="v2-h3">{p.title}</p>
      {p.children ? <div className="v2-floor-note-text">{p.children}</div> : null}
      {p.action}
    </div>
  );
}

/** A line of text in the kit's three voices: plain, quiet (`sub`), or a failure (`alert`). */
export function Line(p: { quiet?: boolean; strong?: boolean; bad?: boolean; children: ReactNode }) {
  const cls = p.bad ? 'v2-floor-bad' : p.quiet ? 'v2-sub' : p.strong ? 'v2-h3' : 'v2-lede';
  return <p className={cls}>{p.children}</p>;
}

type Bare<T extends 'input' | 'textarea' | 'select' | 'label'> = Omit<
  ComponentProps<T>,
  'className' | 'style'
>;

export function FieldLabel(props: Bare<'label'>) {
  return <label className="v2-floor-label" {...props} />;
}
export function TextInput(props: Bare<'input'>) {
  return <input className="v2-floor-field" {...props} />;
}
export function TextArea(props: Bare<'textarea'>) {
  return <textarea rows={3} className="v2-floor-field" {...props} />;
}
export function SelectBox(props: Bare<'select'>) {
  return <select className="v2-floor-field" {...props} />;
}
/** A tick box as a full-width row: the whole row is the tap target. */
export function CheckRow({ label, ...rest }: Omit<Bare<'input'>, 'type'> & { label: string }) {
  return (
    <label className="v2-floor-field v2-floor-check">
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

/** Full-width buttons, one under another (`pair` puts two side by side). */
export function Actions(p: { pair?: boolean; children: ReactNode }) {
  return <div className={p.pair ? 'v2-floor-pair' : 'v2-floor-actions'}>{p.children}</div>;
}
