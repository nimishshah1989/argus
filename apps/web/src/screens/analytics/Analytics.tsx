import { lazy, Suspense } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { groupFor } from './groups.js';
import { TeamFocusFace } from './TeamFocusFace.js';
import { BreakdownsPage } from './BreakdownsPage.js';
import { DataChecklist } from './DataChecklist.js';
import { ForecastPage } from './ForecastPage.js';
import { GroupPage } from './GroupPage.js';
import { GuidePage } from './GuidePage.js';
import { MachinesPage } from './MachinesPage.js';
import { MoneyPage } from './MoneyPage.js';
import { ReportsPage } from './ReportsPage.js';
import { AnalyticsShell } from './shell/AnalyticsShell.js';
import { ActionCenterLive, MachinePageLive, liveScreen } from '../v2/live.js';

// The PM calendar is the one lazy page (ADR 0009 R1): FullCalendar and its theme load only when a head opens
// `/analytics/pm`, never in the start-up files.
const PmCalendarPage = lazy(() => import('./PmCalendarPage.js'));

/** The data checklist's own route, inside the Today group's shell. */
export function DataChecklistPage() {
  const today = groupFor('today');
  if (!today) return <Navigate to="/analytics/today" replace />;
  return (
    <AnalyticsShell>
      <DataChecklist />
    </AnalyticsShell>
  );
}

/** The Action Center's own route (`/analytics/today/action-center`): the v2 screen, in the v2 shell. */
export function ActionCenterRoute() {
  return <ActionCenterLive />;
}

/** One machine's page (`/analytics/machines/:id`): the v2 screen, in the v2 shell. */
export function MachinePageRoute() {
  return <MachinePageLive />;
}

/** The face itself: `/analytics` opens on Today; an unknown group falls back to it (no 404 screen). */
export function AnalyticsFace() {
  const { group } = useParams();
  const [params] = useSearchParams();
  const found = groupFor(group);
  if (!found) return <Navigate to="/analytics/today" replace />;
  const live = liveScreen(group, params.get('screen'));
  if (live) return live;
  return (
    <AnalyticsShell>
      {found.id === 'guide' ? (
        <GuidePage />
      ) : found.id === 'today' ? (
        <TeamFocusFace group={found} />
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
    </AnalyticsShell>
  );
}
