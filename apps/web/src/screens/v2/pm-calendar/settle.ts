import type { PmJob } from './model.js';

/**
 * What the move form does with the answer: an empty day never asks the server, and the form closes only when the
 * server accepted the day. `close` is told which job landed, so it can close that job's own form and no other.
 */
export async function settleMove(
  move: (job: PmJob, day: string) => Promise<boolean>,
  job: PmJob,
  day: string,
  close: (job: PmJob) => void,
): Promise<boolean> {
  if (day === '') return false;
  const landed = await move(job, day);
  if (landed) close(job);
  return landed;
}

/**
 * The form that is open after job `landed`'s move came back: its own form closes, but another job's form, opened while
 * this move was in flight, stays open (it is a form of its own, keyed by its job, so it holds that job's day).
 */
export const leave = (open: PmJob | null, landed: PmJob): PmJob | null =>
  open !== null && open.id === landed.id ? null : open;
