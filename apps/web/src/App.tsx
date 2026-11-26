/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { UpdateBanner } from './components/UpdateBanner.js';
import { Page } from './ui/layout.js';
import { BoardPage } from './screens/v2/board/Page.js';
import { DeskMinePage, DeskTeamPage } from './screens/v2/desk/Page.js';
import { ChangePassword } from './faces/signin/password.js';
import { Who } from './faces/signin/who.js';
import { SignInView } from './screens/v2/sign-in/View.js';
import {
  FloorMinePage,
  FloorOtherPage,
  FloorPmPage,
  FloorReportPage,
} from './screens/v2/floor/Page.js';
import { Settings } from './screens/Settings.js';
import { TicketRoute } from './screens/desk/TicketRoute.js';
import {
  ActionCenterRoute,
  AnalyticsFace,
  DataChecklistPage,
  MachinePageRoute,
} from './screens/analytics/Analytics.js';
import { PLANT_PAGES } from './screens/settings/Plant.js';
import { SettingsView } from './screens/v2/settings/View.js';

// Decided at build time: in a production build without VITE_GALLERY=on this is `false`, so the
// bundler drops the gallery (D20).
const Gallery =
  import.meta.env.DEV || import.meta.env.VITE_GALLERY === 'on'
    ? lazy(() => import('./gallery/Gallery.js'))
    : null;

export function App() {
  const { t } = useTranslation();
  const location = useLocation();
  const kiosk = location.pathname === '/desk/board' && location.search.includes('kiosk=1');
  return (
    <>
      <UpdateBanner auto={kiosk} />
      <Routes>
        <Route path="/login" element={<SignInView />} />
        <Route path="/who" element={<Who />} />
        <Route path="/password" element={<ChangePassword />} />
        <Route path="/floor" element={<FloorReportPage />} />
        <Route path="/floor/other" element={<FloorOtherPage />} />
        <Route path="/floor/mine" element={<FloorMinePage />} />
        <Route path="/floor/pm" element={<FloorPmPage />} />
        <Route path="/desk/mine" element={<DeskMinePage />} />
        <Route path="/desk/team" element={<DeskTeamPage />} />
        <Route path="/desk/board" element={<BoardPage />} />
        <Route path="/desk/settings" element={<Settings />} />
        <Route path="/settings" element={<SettingsView page="home" />} />
        {PLANT_PAGES.map(({ page }) => (
          <Route key={page} path={`/settings/${page}`} element={<SettingsView page={page} />} />
        ))}
        <Route path="/analytics" element={<Navigate to="/analytics/today" replace />} />
        <Route path="/analytics/today/checklist" element={<DataChecklistPage />} />
        <Route path="/analytics/today/action-center" element={<ActionCenterRoute />} />
        <Route path="/analytics/machines/:id" element={<MachinePageRoute />} />
        <Route path="/analytics/:group" element={<AnalyticsFace />} />
        <Route path="/desk/:id?" element={<TicketRoute />} />
        <Route
          path="/gallery"
          element={
            Gallery ? (
              <Suspense fallback={null}>
                <Gallery />
              </Suspense>
            ) : (
              <Page title={t('kit.notFound')} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/floor" replace />} />
      </Routes>
    </>
  );
}
