/**
 * Ticket 628 (ADR 0029): a figures read's reply body, built once per kept run and held in this process.
 *
 * A kept run with five years of history is about 13 MB of JSON. Reading it out of `kpi_snapshot`, parsing it and
 * stringifying it again cost about 150 ms of one Node process per read, so 30 readers queued to a p95 of 4.4 s
 * (ticket 607). Here a read asks Postgres only for the kept row's `run_id` (a new id on every keep) and the data
 * stamp; when this process already holds a body for that run, the plant date and the caller's money view, it sends
 * those bytes, gzipped once. Only a body this process has not built yet reads the kept value.
 *
 * - The body is exactly what `GET /analytics/figures` replied before (same figures, money hidden for non-money
 *   readers, same profile), as JSON, gzipped.
 * - ETag `"<run_id>.m"` (money shown) or `"<run_id>.p"` (money hidden). `If-None-Match` naming it gets 304 with no
 *   body. Headers on 200 and 304: `etag`, `cache-control: private, no-cache`, `vary: accept-encoding`.
 * - A caller whose `accept-encoding` does not name gzip gets the same JSON unzipped.
 * - The stamp check and the warm job stay as in `servedRun` (ADR 0024): a moved stamp queues a warm job and the
 *   kept body still goes out. A cold miss (nothing kept) still computes once and keeps, as before.
 * - At most `SERVED_BODY_LIMIT` bodies are held; adding one more drops the least recently used.
 * - Readers that ask for the same body at the same time build it once.
 */

/** Bodies one process holds at most (a body is about 1–2 MB gzipped for five years). */
export const SERVED_BODY_LIMIT = 32;

/** One reply body for a kept run, a plant date and a money view. */
export interface ServedBody {
  /** `"<run_id>.m"` or `"<run_id>.p"`, quotes included: the ETag header as sent. */
  etag: string;
  /** The reply JSON, gzipped. */
  gzip: Buffer;
}

/** How many bodies this process built from a kept run (each build reads the kept value once). Test helper. */
export function bodiesBuilt(): number {
  throw new Error('not built: ticket 628');
}

/** Test helper: empties the held bodies and sets `bodiesBuilt()` back to 0. */
export function resetServedBodies(): void {
  throw new Error('not built: ticket 628');
}
