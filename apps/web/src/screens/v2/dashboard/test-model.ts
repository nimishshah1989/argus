import { DEFAULT_PROFILE } from '@uptimo/shared';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { en } from '@uptimo/shared/i18n';
import { run } from '@uptimo/domain';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';
import { priorDate } from '../../analytics/today-change.js';
import { AS_OF, realReply } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { dashboardModel } from './adapter.js';
import type { DashboardModel, PlantMachine } from './model.js';

/** The catalogue as a screen asks for it: `{n}` gaps and i18next's `{{n}}` gaps both filled. */
const t: Translate = (key, values = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{?(\w+)\}?\}/g, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );

/** The engine's reply for the answer key on the day the Dashboard compares with (12 October), as the server would send it. */
export function priorReply(): FiguresReply {
  const day = priorDate(AS_OF);
  return {
    ...realReply(),
    asOf: day,
    figures: run(ENGINE_DATA, day, DEFAULT_PROFILE).figures as unknown as FiguresReply['figures'],
  };
}

/** The Dashboard of the frozen 11 November answer key against 12 October, no open tickets and no Action Center board, for tests only. */
export function dashboardTestModel(): Promise<DashboardModel> {
  const machines: PlantMachine[] = ENGINE_DATA.machines.map((m) => ({
    id: m.id,
    code: m.code,
    category: m.category ?? null,
    cell: m.cell ?? null,
  }));
  return Promise.resolve(
    dashboardModel(
      {
        reply: realReply(),
        prior: priorReply(),
        open: { tickets: [], now: '2026-11-11T09:00:00.000Z' },
        board: null,
        machines,
      },
      t,
    ),
  );
}
