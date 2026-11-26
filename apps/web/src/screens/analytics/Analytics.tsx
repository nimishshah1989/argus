// The analytics routes moved to the v2 kit (screens/v2/analytics-routes.tsx), which App.tsx imports. This name stays
// for the tests that read or import it; the shipped app never reaches it.
export {
  ActionCenterRoute,
  AnalyticsFace,
  DataChecklistPage,
  MachinePageRoute,
} from '../v2/analytics-routes.js';
