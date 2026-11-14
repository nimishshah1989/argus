import { useEffect } from 'react';
import { useTicketPages, type Ticket, type TicketListQuery } from '../../api.js';
import { ticketTime } from './views.js';

/**
 * Every ticket of a list, read page by page by cursor (the server never sends more than 200 at once).
 * With `since`, it stops once a whole page is older than that time, so a 30-day list holds all of its
 * rows however many there are, and the monthly totals are not cut off at the first page.
 */
export function useTicketWindow(query: TicketListQuery, since?: number) {
  const pages = useTicketPages({ ...query, limit: 200 });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = pages;
  const last = pages.data?.pages.at(-1)?.items ?? [];
  const olderThanWindow =
    since !== undefined && last.length > 0 && last.every((ticket) => ticketTime(ticket) < since);
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !olderThanWindow) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, olderThanWindow, fetchNextPage, pages.data?.pages.length]);
  const items: Ticket[] = pages.data?.pages.flatMap((page) => page.items) ?? [];
  const loading = pages.isLoading || (hasNextPage === true && !olderThanWindow);
  return { items, loading, error: pages.error };
}
