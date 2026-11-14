import { useWide } from '../../patterns/wide.js';
import { Desk } from '../Desk.js';
import { TicketDetail } from '../TicketDetail.js';

/** `/desk/:id`: a ticket page on a phone, the Open list with that ticket beside it from 1024 px. */
export function TicketRoute() {
  // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
  return useWide() ? <Desk view="open" /> : <TicketDetail />;
}
