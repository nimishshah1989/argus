import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ACTION_CENTER_PATH, groupFor } from './groups.js';
import { ActionCenterPage } from '../v2/action-center/Page.js';
import { GroupPage } from './GroupPage.js';
import { GuidePage } from './GuidePage.js';
import { MachinePage } from '../v2/machine/Page.js';
import { LiveFrame } from '../v2/live-frame.js';
import { MachinesPage } from './MachinesPage.js';
import { MoneyPage } from './MoneyPage.js';
import { TodayRest } from './TodayRest.js';
import { ReportsPage } from './ReportsPage.js';
import { AnalyticsShell } from './shell/AnalyticsShell.js';
import { liveScreen } from '../v2/live.js';

/** The data checklist's own route, inside the Today group's shell. */
export function DataChecklistPage() {
  return liveScreen('today', 'data-checklist');
}

/** The Action Center's own route: the v2 screen, with its own frame. */
export function ActionCenterRoute() {
  return <ActionCenterPage />;
}

/** One machine's page (`/analytics/machines/:id`, an id or a code): the v2 screen, in the v2 shell. */
export function MachinePageRoute() {
  const { id = '' } = useParams();
  return (
    // eslint-disable-next-line i18next/no-literal-string -- a group, a section and a screen id, not copy
    <LiveFrame entry={{ group: 'machines', section: 'machines', screen: 'machine-page' }}>
      {(nav) => <MachinePage id={id} nav={nav} />}
    </LiveFrame>
  );
}

/** The Action Center has its own route; a link that names it as a screen of Today goes there. */
function ownRoute(group: string | undefined, screen: string | null) {
  return group === 'today' && screen === 'action-center' ? (
    <Navigate to={ACTION_CENTER_PATH} replace />
  ) : null;
}

/** The face itself: `/analytics` opens on Today; an unknown group falls back to it (no 404 screen). */
export function AnalyticsFace() {
  const { group } = useParams();
  const [params] = useSearchParams();
  const found = groupFor(group);
  if (!found) return <Navigate to="/analytics/today" replace />;
  const own = ownRoute(group, params.get('screen'));
  if (own) return own;
  const live = liveScreen(group, params.get('screen'));
  if (live) return live;
  return (
    <AnalyticsShell>
      {found.id === 'guide' ? (
        <GuidePage />
      ) : found.id === 'today' ? (
        <TodayRest group={found} />
      ) : found.id === 'machines' ? (
        <MachinesPage group={found} />
      ) : found.id === 'cost' ? (
        <MoneyPage group={found} />
      ) : found.id === 'reports' ? (
        <ReportsPage group={found} />
      ) : (
        <GroupPage group={found} />
      )}
    </AnalyticsShell>
  );
}
