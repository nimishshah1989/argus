import { Dashboard } from '../screens/v2/dashboard/Dashboard.js';
import { dashboardFixture } from '../screens/v2/dashboard/fixture.js';

/** The v2 Dashboard on its invented fixture: what Nimish approves here is what ships with the API behind it. */
export default function V2DashboardView() {
  return <Dashboard model={dashboardFixture} />;
}
