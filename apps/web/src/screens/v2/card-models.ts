import { ENGINE_DATA } from '../../../../../packages/domain/test/answer-key/fixture.js';
import { frozenActionCenter } from './action-center/frozen.js';
import { ageModel } from './age/adapter.js';
import { bdPmFromReply } from './bd-pm/live.js';
import { bottleneckFromReply } from './bottleneck/live.js';
import { categoryCellFromReply } from './category-cell/live.js';
import { cellLogModel } from './cell-change-log/adapter.js';
import { compareFixture } from './compare/fixture.js';
import { COMPARABLE } from './compare/fixture-rows.js';
import { dashboardModel } from './dashboard/adapter.js';
import { dataChecklistFixture } from './data-checklist/fixture.js';
import { energyFromReply } from './energy/live.js';
import { catalogue } from './figures/live.js';
import { codeOfUuid, realReply } from './figures/real-reply.js';
import { fixFinderFromReply } from './fix-finder/live.js';
import { footprintModel } from './footprint/adapter.js';
import { forecastLabFromReply } from './forecast-lab/live.js';
import { machinePageModel } from './machine/adapter.js';
import { registersModel } from './machines-register/adapter.js';
import { manpowerFromReply } from './manpower/live.js';
import { moneyMattersModel } from './money-matters/adapter.js';
import { monthlyReportFromReply } from './monthly-report/live.js';
import { mttrMtbfFromReply } from './mttr-mtbf/live.js';
import { oemModel } from './oem/adapter.js';
import { pmCalendarFromStandIn } from './pm-calendar/source.js';
import { problemAnalysisFromReply } from './problem-analysis/live.js';
import { shiftKpisFromReply } from './shift-kpis/live.js';
import { teamFocusFixture } from './team-focus/fixture.js';

/**
 * Every v2 screen that draws a KPI card, a figure tile or a chart card, built from the frozen 11 November engine reply
 * or the screen's own fixture: what the destinations guard (`destinations.test.ts`) walks. Test-only.
 */
export function cardModels(): Record<string, () => Promise<unknown> | unknown> {
  const reply = realReply();
  const machines = ENGINE_DATA.machines.map((m) => ({
    id: m.id,
    code: m.code,
    category: m.category ?? null,
    cell: m.cell ?? null,
  }));
  const t = catalogue;
  return {
    dashboard: () =>
      dashboardModel(
        { reply, open: { tickets: [], now: `${reply.asOf}T09:00:00.000Z` }, board: null, machines },
        t,
      ),
    'action-center': () => frozenActionCenter(),
    age: () => ageModel(reply, t),
    'bd-pm': () => bdPmFromReply(reply),
    bottleneck: () => bottleneckFromReply(reply, (id: string) => codeOfUuid(id) ?? id),
    'category-cell': () => categoryCellFromReply(reply),
    'cell-change-log': () =>
      cellLogModel(reply, t, { codeOf: () => null, role: 'head', today: reply.asOf }),
    compare: () => compareFixture({ a: COMPARABLE[0] ?? '', b: COMPARABLE[1] ?? '' }),
    'data-checklist': () => dataChecklistFixture,
    energy: () => energyFromReply(reply),
    'fix-finder': () => fixFinderFromReply(reply),
    footprint: () => footprintModel(reply, t),
    'forecast-lab': () => forecastLabFromReply(reply),
    machine: () =>
      machinePageModel(
        reply,
        {
          param: machines[0]!.code,
          machines: ENGINE_DATA.machines as never,
          tickets: [],
          timeZone: 'Asia/Kolkata',
        },
        t,
      ),
    'machines-register': () => registersModel(reply, t),
    manpower: () => manpowerFromReply(reply),
    'money-matters': () => moneyMattersModel(reply, t as never, { money: true }),
    'monthly-report': () => monthlyReportFromReply(reply),
    'mttr-mtbf': () => mttrMtbfFromReply(reply),
    oem: () => oemModel(reply, t, { mayDecide: false }),
    'pm-calendar': () => pmCalendarFromStandIn({ range: null }),
    'problem-analysis': () => problemAnalysisFromReply(reply),
    'shift-kpis': () => shiftKpisFromReply(reply),
    'team-focus': () => teamFocusFixture,
  };
}
