import { lazy, Suspense, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWide } from '../../patterns/wide.js';
import { SideNav } from '../../ui/side-nav.js';
import { TopBar } from '../../ui/top-bar.js';
import { useSystemTheme } from '../desk/Shell.js';
import { List } from '../../ui/icon.js';
import {
  ACTION_CENTER_PATH,
  ANALYTICS_GROUPS,
  CHECKLIST_PATH,
  MACHINES_PATH,
  groupFor,
  type AnalyticsGroup,
} from './groups.js';
import { ActionCenterPage } from './ActionCenterPage.js';
import { Dashboard } from './Dashboard.js';
import { BreakdownsPage } from './BreakdownsPage.js';
import { DataChecklist } from './DataChecklist.js';
import { ForecastPage } from './ForecastPage.js';
import { GroupPage } from './GroupPage.js';
import { GuidePage } from './GuidePage.js';
import { MachinePage } from './MachinePage.js';
import { MachinesPage } from './MachinesPage.js';
import { MoneyPage } from './MoneyPage.js';
import { ReportsPage } from './ReportsPage.js';

// The PM calendar is the one lazy page (ADR 0009 R1): FullCalendar and its theme load only when a head opens
// `/analytics/pm`, never in the start-up files.
const PmCalendarPage = lazy(() => import('./PmCalendarPage.js'));

const DESK = '/desk';

/** The data checklist's own route, inside the Today group's shell. */
export function DataChecklistPage() {
  const today = groupFor('today');
  if (!today) return <Navigate to="/analytics/today" replace />;
  return (
    <FaceShell group={today} current={CHECKLIST_PATH}>
      <DataChecklist />
    </FaceShell>
  );
}

/** The Action Center's own route, inside the Today group's shell (packet 44d). */
export function ActionCenterRoute() {
  const today = groupFor('today');
  if (!today) return <Navigate to="/analytics/today" replace />;
  return (
    <FaceShell group={today} current={ACTION_CENTER_PATH}>
      <ActionCenterPage />
    </FaceShell>
  );
}

/** One machine's page: inside the Machines group's shell, with that group's menu entry marked. */
export function MachinePageRoute() {
  const machines = groupFor('machines');
  if (!machines) return <Navigate to="/analytics/today" replace />;
  return (
    <FaceShell group={machines} current={MACHINES_PATH}>
      <MachinePage group={machines} />
    </FaceShell>
  );
}

/** The face itself: `/analytics` opens on Today; an unknown group falls back to it (no 404 screen). */
export function AnalyticsFace() {
  const { group } = useParams();
  const found = groupFor(group);
  if (!found) return <Navigate to="/analytics/today" replace />;
  return (
    <FaceShell group={found}>
      {found.id === 'guide' ? (
        <GuidePage />
      ) : found.id === 'today' ? (
        <Dashboard group={found} />
      ) : found.id === 'machines' ? (
        <MachinesPage group={found} />
      ) : found.id === 'breakdowns' ? (
        <BreakdownsPage group={found} />
      ) : found.id === 'forecast-scorecard' ? (
        <ForecastPage group={found} />
      ) : found.id === 'cost' ? (
        <MoneyPage group={found} />
      ) : found.id === 'reports' ? (
        <ReportsPage group={found} />
      ) : found.id === 'pm' ? (
        <Suspense fallback={null}>
          <PmCalendarPage group={found} />
        </Suspense>
      ) : (
        <GroupPage group={found} />
      )}
    </FaceShell>
  );
}

/**
 * The face's links: the eight locked groups, then Data checklist at the foot (the design lock's order).
 * Pure data, so the wide menu and the phone menu cannot drift apart.
 */
function menuEntries() {
  return [
    ...ANALYTICS_GROUPS.map(({ id, labelKey, icon }) => ({
      to: `/analytics/${id}`,
      labelKey,
      icon,
    })),
    { to: CHECKLIST_PATH, labelKey: 'analytics.screen.data-checklist', icon: List },
  ];
}

function PhoneMenu({ current }: { current: string }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('analytics.menu')} className="rounded-2xl bg-surface p-2 shadow-card">
      <ul className="flex flex-wrap gap-1">
        {menuEntries().map(({ to, labelKey }) => (
          <li key={to}>
            <Link
              to={to}
              // eslint-disable-next-line i18next/no-literal-string -- ARIA value, not copy
              aria-current={to === current ? 'page' : undefined}
              className="flex min-h-target items-center rounded-xl px-3 text-footnote font-medium text-neutral-900 aria-[current=page]:bg-accent-tint aria-[current=page]:font-semibold aria-[current=page]:text-accent-text"
            >
              {t(labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function menuItems(t: (key: string) => string) {
  return menuEntries().map(({ to, labelKey, icon }) => ({ to, label: t(labelKey), icon }));
}

function FaceShell({
  group,
  children,
  current,
}: {
  group: AnalyticsGroup;
  children: ReactNode;
  /** The menu link to mark as this page: the group's route, or the checklist's own route. */
  current?: string;
}) {
  const { t } = useTranslation();
  const wide = useWide();
  useSystemTheme();
  const here = current ?? `/analytics/${group.id}`;
  if (wide)
    return (
      <div className="flex min-h-dvh bg-neutral-100 text-neutral-900">
        <div className="sticky top-0 h-dvh">
          <SideNav label={t('analytics.menu')} groups={[{ items: menuItems(t) }]} current={here} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar title={t(group.labelKey)} />
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
            {children}
          </main>
        </div>
      </div>
    );
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-100 text-neutral-900">
      <TopBar title={t(group.labelKey)} back={{ to: DESK, label: t('nav.desk') }} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">
        <PhoneMenu current={here} />
        {children}
      </main>
    </div>
  );
}
