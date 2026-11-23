import type { ActionCenterBoardReply } from '@uptimo/shared';

/**
 * What the other Today screens still read of the Action Center: the platform's plant-day boundary, a plant day as
 * DD-MM-YYYY, and the Dashboard banner's two counts. The screen itself is `screens/v2/action-center/`.
 */

/** The platform's plant-day boundary for an ISO instant: the date the plant was on, not the browser's. */
export function plantDayOf(instant: string, timeZone: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** A plant day (YYYY-MM-DD) as the platform prints it (DD-MM-YYYY); '' for no date. */
export function dmy(day: string | null): string {
  if (day === null || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const [year, month, date] = day.split('-');
  return `${date}-${month}-${year}`;
}

/** The Dashboard banner's two counts, or null when no nudge is open (the platform hides it then). */
export function bannerOf(board: ActionCenterBoardReply): { high: number; medium: number } | null {
  if (board.counts.open === 0) return null;
  return { high: board.bySeverity.high, medium: board.bySeverity.med };
}
