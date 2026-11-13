import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Page } from './ui/layout.js';
import { Board } from './screens/Board.js';
import { Desk } from './screens/Desk.js';
import { Floor } from './screens/Floor.js';
import { Login } from './screens/Login.js';
import { Settings } from './screens/Settings.js';
import { TicketDetail } from './screens/TicketDetail.js';

// Decided at build time: in a production build without VITE_GALLERY=on this is `false`, so the
// bundler drops the gallery (D20).
const Gallery =
  import.meta.env.DEV || import.meta.env.VITE_GALLERY === 'on'
    ? lazy(() => import('./gallery/Gallery.js'))
    : null;

export function App() {
  const { t } = useTranslation();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/floor" element={<Floor />} />
      <Route path="/desk" element={<Desk />} />
      <Route path="/desk/board" element={<Board />} />
      <Route path="/desk/settings" element={<Settings />} />
      <Route path="/desk/:id" element={<TicketDetail />} />
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
  );
}
