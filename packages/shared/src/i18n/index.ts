import { commonEn } from './common.en.js';
import { commonGu } from './common.gu.js';
import { deskEn } from './desk.en.js';
import { deskGu } from './desk.gu.js';
import { deskListsEn } from './desk-lists.en.js';
import { deskListsGu } from './desk-lists.gu.js';
import { floorEn } from './floor.en.js';
import { floorGu } from './floor.gu.js';
import { ticketEn } from './ticket.en.js';
import { ticketGu } from './ticket.gu.js';
import { slaEn } from './sla.en.js';
import { slaGu } from './sla.gu.js';
import { actionsEn } from './actions.en.js';
import { actionsGu } from './actions.gu.js';
import { reportEn } from './report.en.js';
import { reportGu } from './report.gu.js';
import { statusTicketEn } from './status-ticket.en.js';
import { statusTicketGu } from './status-ticket.gu.js';
import { adminEn } from './admin.en.js';
import { adminGu } from './admin.gu.js';
import { boardEn } from './board.en.js';
import { boardGu } from './board.gu.js';
import { settingsEn } from './settings.en.js';
import { settingsGu } from './settings.gu.js';
import { statusSignalEn } from './status-signal.en.js';
import { statusSignalGu } from './status-signal.gu.js';
import { statusFloorEn } from './status-floor.en.js';
import { statusFloorGu } from './status-floor.gu.js';
import { detailEn } from './detail.en.js';
import { detailGu } from './detail.gu.js';
import { statusFlowEn } from './status-flow.en.js';
import { statusFlowGu } from './status-flow.gu.js';
import { reportFloorEn } from './report-floor.en.js';
import { reportFloorGu } from './report-floor.gu.js';

/** The English catalogues by namespace; each key lives in exactly one. */
export const NAMESPACES: Record<string, Record<string, string>> = {
  common: commonEn,
  desk: deskEn,
  'desk-lists': deskListsEn,
  floor: floorEn,
  ticket: ticketEn,
  detail: detailEn,
  sla: slaEn,
  actions: actionsEn,
  report: reportEn,
  'status-ticket': statusTicketEn,
  admin: adminEn,
  board: boardEn,
  settings: settingsEn,
  'status-signal': statusSignalEn,
  'status-flow': statusFlowEn,
  'status-floor': statusFloorEn,
  'report-floor': reportFloorEn,
};

/** One flat catalogue; no type annotation, so `MessageKey` keeps every key as a literal. */
export const en = {
  ...commonEn,
  ...deskEn,
  ...deskListsEn,
  ...floorEn,
  ...ticketEn,
  ...detailEn,
  ...slaEn,
  ...actionsEn,
  ...reportEn,
  ...statusTicketEn,
  ...adminEn,
  ...boardEn,
  ...settingsEn,
  ...statusSignalEn,
  ...statusFlowEn,
  ...statusFloorEn,
  ...reportFloorEn,
};

export type MessageKey = keyof typeof en;

/** Gujarati placeholder (SPEC 1.11): the same keys, empty values, until real strings arrive (ticket 24). */
export const gu = {
  ...commonGu,
  ...deskGu,
  ...deskListsGu,
  ...floorGu,
  ...ticketGu,
  ...detailGu,
  ...slaGu,
  ...actionsGu,
  ...reportGu,
  ...statusTicketGu,
  ...adminGu,
  ...boardGu,
  ...settingsGu,
  ...statusSignalGu,
  ...statusFlowGu,
  ...statusFloorGu,
  ...reportFloorGu,
};
