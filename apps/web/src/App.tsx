import { Navigate, Route, Routes } from 'react-router-dom';
import { DesignPreview } from './design-preview/DesignPreview.js';
import { Board } from './screens/Board.js';
import { Desk } from './screens/Desk.js';
import { Floor } from './screens/Floor.js';
import { Login } from './screens/Login.js';
import { TicketDetail } from './screens/TicketDetail.js';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/design-preview" element={<DesignPreview />} />
      <Route path="/floor" element={<Floor />} />
      <Route path="/desk" element={<Desk />} />
      <Route path="/desk/board" element={<Board />} />
      <Route path="/desk/:id" element={<TicketDetail />} />
      <Route path="*" element={<Navigate to="/floor" replace />} />
    </Routes>
  );
}
