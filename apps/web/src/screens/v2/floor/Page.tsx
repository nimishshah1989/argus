import type { ReactNode } from 'react';

/**
 * The live wiring (ADR 0045 T1): v1's `useFloorData` (config, state, me; retry), v1's `useReport` (reused as is:
 * pick, upgrade-kind, raise, 409 → the open breakdown's sheet, refresh `state` + `tickets`), `readRecent()`,
 * `useOnline()`, the router. Draws `FloorFrame` around `ReportView` / `OtherWorkView`, or `FloorWaitingView`.
 */

/** `/floor`: the report flow. `?m=CODE` opens Step 2 once; "Report another machine" starts a fresh flow without it. */
export function FloorReportPage(): ReactNode {
  throw new Error('not implemented');
}

/** `/floor/other`: a work request (`raiseTicket` kind `general`; invalidates `tickets`). */
export function FloorOtherPage(): ReactNode {
  throw new Error('not implemented');
}
