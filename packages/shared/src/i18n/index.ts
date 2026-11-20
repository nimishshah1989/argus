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
import { appUpdateEn } from './app-update.en.js';
import { appUpdateGu } from './app-update.gu.js';
import { liveBoardEn } from './live-board.en.js';
import { liveBoardGu } from './live-board.gu.js';
import { settingsEn } from './settings.en.js';
import { settingsGu } from './settings.gu.js';
import { statusSignalEn } from './status-signal.en.js';
import { statusSignalGu } from './status-signal.gu.js';
import { statusFloorEn } from './status-floor.en.js';
import { statusFloorGu } from './status-floor.gu.js';
import { statusTaskEn } from './status-task.en.js';
import { deskWideEn } from './desk-wide.en.js';
import { deskWideGu } from './desk-wide.gu.js';
import { statusTaskGu } from './status-task.gu.js';
import { detailEn } from './detail.en.js';
import { detailGu } from './detail.gu.js';
import { statusFlowEn } from './status-flow.en.js';
import { statusFlowGu } from './status-flow.gu.js';
import { reportFloorEn } from './report-floor.en.js';
import { reportFloorGu } from './report-floor.gu.js';
import { closesEn } from './closes.en.js';
import { closesGu } from './closes.gu.js';
import { signinEn } from './signin.en.js';
import { signinGu } from './signin.gu.js';
import { signoffEn } from './signoff.en.js';
import { signoffGu } from './signoff.gu.js';
import { plantEn } from './plant.en.js';
import { plantGu } from './plant.gu.js';
import { pmEn } from './pm.en.js';
import { pmGu } from './pm.gu.js';
import { lockoutEn } from './lockout.en.js';
import { tasksEn } from './tasks.en.js';
import { listsEn } from './lists.en.js';
import { listsGu } from './lists.gu.js';
import { companyEn } from './company.en.js';
import { companyGu } from './company.gu.js';
import { lockoutGu } from './lockout.gu.js';
import { accountEn } from './account.en.js';
import { accountGu } from './account.gu.js';
import { tasksGu } from './tasks.gu.js';
import { peopleEn } from './people.en.js';
import { peopleGu } from './people.gu.js';
import { crudEn } from './crud.en.js';
import { crudGu } from './crud.gu.js';
import { auditEn } from './audit.en.js';
import { auditGu } from './audit.gu.js';
import { jobsEn } from './jobs.en.js';
import { jobsGu } from './jobs.gu.js';
import { analyticsEn } from './analytics.en.js';
import { analyticsGu } from './analytics.gu.js';
import { analyticsMachinesEn } from './analytics-machines.en.js';
import { analyticsMachinesGu } from './analytics-machines.gu.js';
import { analyticsBreakdownsEn } from './analytics-breakdowns.en.js';
import { analyticsBreakdownsGu } from './analytics-breakdowns.gu.js';
import { analyticsForecastEn } from './analytics-forecast.en.js';
import { analyticsForecastGu } from './analytics-forecast.gu.js';
import { analyticsEventsEn } from './analytics-events.en.js';
import { analyticsEventsGu } from './analytics-events.gu.js';
import { analyticsCompareEn } from './analytics-compare.en.js';
import { analyticsCompareGu } from './analytics-compare.gu.js';
import { analyticsActionCenterEn } from './analytics-action-center.en.js';
import { analyticsActionCenterGu } from './analytics-action-center.gu.js';
import { analyticsGuideEn } from './analytics-guide.en.js';
import { analyticsGuideGu } from './analytics-guide.gu.js';
import { analyticsReportEn } from './analytics-report.en.js';
import { analyticsReportGu } from './analytics-report.gu.js';
import { analyticsShellEn } from './analytics-shell.en.js';
import { analyticsShellGu } from './analytics-shell.gu.js';
import { analyticsRegisterEn } from './analytics-register.en.js';
import { analyticsRegisterGu } from './analytics-register.gu.js';
import { analyticsTablesEn } from './analytics-tables.en.js';
import { analyticsTablesGu } from './analytics-tables.gu.js';
import { analyticsV2ActionEn } from './analytics-v2-action.en.js';
import { analyticsV2ActionGu } from './analytics-v2-action.gu.js';
import { analyticsV2ForecastEn } from './analytics-v2-forecast.en.js';
import { analyticsV2ForecastGu } from './analytics-v2-forecast.gu.js';
import { analyticsV2MachinesEn } from './analytics-v2-machines.en.js';
import { analyticsV2MachinesGu } from './analytics-v2-machines.gu.js';
import { analyticsV2ProblemsEn } from './analytics-v2-problems.en.js';
import { analyticsV2ProblemsGu } from './analytics-v2-problems.gu.js';
import { analyticsV2ReliabilityEn } from './analytics-v2-reliability.en.js';
import { analyticsV2ReliabilityGu } from './analytics-v2-reliability.gu.js';

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
  'live-board': liveBoardEn,
  'app-update': appUpdateEn,
  settings: settingsEn,
  'status-signal': statusSignalEn,
  'status-flow': statusFlowEn,
  'status-floor': statusFloorEn,
  'status-task': statusTaskEn,
  'desk-wide': deskWideEn,
  'report-floor': reportFloorEn,
  closes: closesEn,
  signin: signinEn,
  signoff: signoffEn,
  plant: plantEn,
  pm: pmEn,
  lockout: lockoutEn,
  account: accountEn,
  tasks: tasksEn,
  people: peopleEn,
  crud: crudEn,
  audit: auditEn,
  jobs: jobsEn,
  lists: listsEn,
  company: companyEn,
  analytics: analyticsEn,
  'analytics-machines': analyticsMachinesEn,
  'analytics-breakdowns': analyticsBreakdownsEn,
  'analytics-forecast': analyticsForecastEn,
  'analytics-events': analyticsEventsEn,
  'analytics-compare': analyticsCompareEn,
  'analytics-action-center': analyticsActionCenterEn,
  'analytics-guide': analyticsGuideEn,
  'analytics-report': analyticsReportEn,
  'analytics-shell': analyticsShellEn,
  'analytics-register': analyticsRegisterEn,
  'analytics-tables': analyticsTablesEn,
  'analytics-v2-action': analyticsV2ActionEn,
  'analytics-v2-forecast': analyticsV2ForecastEn,
  'analytics-v2-machines': analyticsV2MachinesEn,
  'analytics-v2-problems': analyticsV2ProblemsEn,
  'analytics-v2-reliability': analyticsV2ReliabilityEn,
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
  ...liveBoardEn,
  ...appUpdateEn,
  ...settingsEn,
  ...statusSignalEn,
  ...statusFlowEn,
  ...statusFloorEn,
  ...statusTaskEn,
  ...deskWideEn,
  ...reportFloorEn,
  ...closesEn,
  ...signinEn,
  ...signoffEn,
  ...plantEn,
  ...pmEn,
  ...lockoutEn,
  ...accountEn,
  ...tasksEn,
  ...peopleEn,
  ...crudEn,
  ...auditEn,
  ...jobsEn,
  ...listsEn,
  ...companyEn,
  ...analyticsEn,
  ...analyticsMachinesEn,
  ...analyticsBreakdownsEn,
  ...analyticsForecastEn,
  ...analyticsEventsEn,
  ...analyticsCompareEn,
  ...analyticsActionCenterEn,
  ...analyticsGuideEn,
  ...analyticsReportEn,
  ...analyticsShellEn,
  ...analyticsRegisterEn,
  ...analyticsTablesEn,
  ...analyticsV2ActionEn,
  ...analyticsV2ForecastEn,
  ...analyticsV2MachinesEn,
  ...analyticsV2ProblemsEn,
  ...analyticsV2ReliabilityEn,
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
  ...liveBoardGu,
  ...appUpdateGu,
  ...settingsGu,
  ...statusSignalGu,
  ...statusFlowGu,
  ...statusFloorGu,
  ...statusTaskGu,
  ...deskWideGu,
  ...reportFloorGu,
  ...closesGu,
  ...signinGu,
  ...signoffGu,
  ...plantGu,
  ...pmGu,
  ...lockoutGu,
  ...accountGu,
  ...tasksGu,
  ...peopleGu,
  ...crudGu,
  ...auditGu,
  ...jobsGu,
  ...listsGu,
  ...companyGu,
  ...analyticsGu,
  ...analyticsMachinesGu,
  ...analyticsBreakdownsGu,
  ...analyticsForecastGu,
  ...analyticsEventsGu,
  ...analyticsCompareGu,
  ...analyticsActionCenterGu,
  ...analyticsGuideGu,
  ...analyticsReportGu,
  ...analyticsShellGu,
  ...analyticsRegisterGu,
  ...analyticsTablesGu,
  ...analyticsV2ActionGu,
  ...analyticsV2ForecastGu,
  ...analyticsV2MachinesGu,
  ...analyticsV2ProblemsGu,
  ...analyticsV2ReliabilityGu,
};

export * from './overrides.js';
