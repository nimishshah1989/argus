import { Navigate, Route, Routes } from 'react-router-dom';
import { Desk } from './screens/Desk.js';
import { Floor } from './screens/Floor.js';
import { Login } from './screens/Login.js';
import { TicketDetail } from './screens/TicketDetail.js';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/floor" element={<Floor />} />
      <Route path="/desk" element={<Desk />} />
      <Route path="/desk/:id" element={<TicketDetail />} />
      <Route path="*" element={<Navigate to="/floor" replace />} />
    </Routes>
  );
}
