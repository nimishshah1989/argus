import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getMe } from '../../api.js';
import { useWide } from '../../patterns/wide.js';
import { DeskOpenPage } from '../v2/desk/Page.js';
import { mayOpen } from '../v2/desk/model.js';
import { TicketPage } from '../v2/ticket/Page.js';

/**
 * `/desk` is the Open list and `/desk/:id` a ticket: its own page on a phone, a pane beside the list from
 * 1024 px. A login that may not open the desk (an operator looking at their own ticket) always gets the page.
 * One route for both, so picking a ticket keeps the list's tab and filter where they were.
 */
export function TicketRoute() {
  const { id } = useParams();
  const wide = useWide();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const role = me.data?.user.role;
  const beside = wide && role !== undefined && mayOpen('open', role);
  // Until the role is known a wide screen shows nothing: the page, then the pane, would flash.
  if (id && wide && me.isPending) return null;
  // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
  return !id || beside ? <DeskOpenPage /> : <TicketPage />;
}
