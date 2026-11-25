import type { TFunction } from 'i18next';
import type { Group, Machine, Ticket } from '../../../api.js';
import type { FloorData } from '../../../faces/floor/use-floor.js';
import type {
  MachineRowModel,
  OtherWorkForm,
  OtherWorkModel,
  ReportModel,
  TabsModel,
  TicketFactsModel,
} from './model.js';

/**
 * The floor's data (v1 `useFloorData`) and the report in progress (v1 `useReport` state) → the models the View draws.
 * Every word through `t`, v1's keys unchanged (`floor.*`, `reportFloor.*`, `tasks.warning*`, `pm.jobs.tab`).
 */

/** The report in progress, as `useReport` and `readRecent()` hold it in Page.tsx. */
export type ReportInput = {
  query: string;
  group: Group | null;
  machine: Machine | null;
  kind: 'stopped' | 'support';
  problem: string;
  startNow: boolean;
  sheet: Ticket | null;
  sent: Ticket | null;
  /** `readRecent()`: machine ids, newest first. */
  recent: string[];
};

/** Other work in progress. */
export type OtherWorkInput = { form: OtherWorkForm; startNow: boolean; sent: Ticket | null };

/** The tab bar for a login (`maintenance` undefined while the login loads) on a path. */
export function tabsModel(
  maintenance: boolean | undefined,
  pathname: string,
  t: TFunction,
): TabsModel {
  void [maintenance, pathname, t];
  throw new Error('not implemented');
}

/** One machine row with its open ticket's status and detail (v1 `machine-row.tsx`). */
export function machineRow(data: FloorData, machine: Machine, t: TFunction): MachineRowModel {
  void [data, machine, t];
  throw new Error('not implemented');
}

/** A ticket's facts card (v1 `sent.tsx` `TicketFacts`). */
export function ticketFacts(data: FloorData, ticket: Ticket, t: TFunction): TicketFactsModel {
  void [data, ticket, t];
  throw new Error('not implemented');
}

/** The report flow: Step 1 (browse or group), Step 2, Step 3, Sent and the ticket sheet (v1 `report.tsx` + steps). */
export function reportModel(data: FloorData, input: ReportInput, t: TFunction): ReportModel {
  void [data, input, t];
  throw new Error('not implemented');
}

/** Other work (v1 `other-work.tsx` + `other-work-fields.tsx`). */
export function otherWorkModel(
  data: FloorData,
  input: OtherWorkInput,
  t: TFunction,
): OtherWorkModel {
  void [data, input, t];
  throw new Error('not implemented');
}
