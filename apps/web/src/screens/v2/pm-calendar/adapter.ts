import type { TFunction } from 'i18next';
import type { PmCalendarItem, PmCalendarReply } from '@uptimo/shared';
import { fill } from '../../../i18n/fill.js';
import type { CalendarEvent } from '../../../ui/v2/domain/calendar-events.js';
import type { FigureData } from '../../../ui/v2/figure-tile.js';
import type { Point } from '../../../ui/v2/points.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import {
  loadOf,
  rateText,
  readPmCompliance,
  shownMonth,
  type PmComplianceView,
} from '../../analytics/pm-calendar-view.js';
import { dayValue, machineChip, shortDate } from '../printed-page/printed.js';
import type { Day, Judged, OutcomeCount, PmCalendarModel, PmJob } from './model.js';
import { pmCalendarWords } from './words.js';

/**
 * What the PM calendar reads: the calendar reply for one stretch of days (`GET /pm/calendar`), the `pm-compliance`
 * figure's value from the figures reply (undefined when the engine has none), the plant's day it was read for, and
 * whether the signed-in role is head or admin (the only roles the server lets move a job).
 */
export type PmCalendarInput = {
  calendar: PmCalendarReply;
  compliance: unknown;
  asOf: string;
  canMove: boolean;
};

/**
 * The calendar reply's fields and where each one goes. A test holds this against the reply schema, so a field the
 * engine adds cannot go missing quietly. `handle` fields are what a write needs and are never printed.
 */
export const REPLY_FIELDS = {
  reply: {
    shown: ['from', 'to', 'today', 'cap', 'items'],
    handle: [],
  },
  item: {
    shown: [
      'machineCode',
      'title',
      'dueOn',
      'scheduledOn',
      'toleranceDays',
      'status',
      'movable',
      'crowded',
      'suggestedOn',
    ],
    handle: ['planId', 'machineId', 'ticketId'],
  },
} as const;

const dayOf = (iso: string): Day => ({ shown: shortDate(iso), iso, value: dayValue(iso) });
const count = (n: number): string => n.toLocaleString('en-IN');
const idOf = (item: PmCalendarItem): string => item.ticketId ?? item.planId ?? item.machineId;

function jobOf(item: PmCalendarItem, t: TFunction, words: { tolerance: string }): PmJob {
  const suggested = item.suggestedOn === null ? null : dayOf(item.suggestedOn);
  return {
    id: idOf(item),
    machine: machineChip(item.machineCode),
    title: item.title,
    planned: dayOf(item.scheduledOn),
    due: dayOf(item.dueOn),
    tolerance: {
      shown: fill(words.tolerance, { n: item.toleranceDays }),
      value: item.toleranceDays,
    },
    status: item.status,
    statusWord: t(
      item.status === 'open' ? 'pm.calendar.legend.open' : 'pm.calendar.legend.planned',
    ),
    crowded: item.crowded,
    movable: item.movable,
    suggested:
      suggested === null
        ? null
        : {
            ...suggested,
            moveLabel: t('pm.calendar.moveTo', { date: suggested.shown }),
            text: t('pm.calendar.suggested', { date: suggested.shown }),
          },
    moveAria: t('pm.calendar.moveDateFor', { machine: item.machineCode }),
    handle: { machineId: item.machineId, planId: item.planId, ticketId: item.ticketId },
  };
}

/** A chip's day and state, as a screen reader hears them after the code (colour never carries it alone). */
function eventOf(item: PmCalendarItem, job: PmJob, t: TFunction): CalendarEvent {
  const key = `pm.calendar.aria.${item.status}${item.crowded ? 'Crowded' : ''}`;
  return {
    id: job.id,
    code: item.machineCode,
    day: item.scheduledOn,
    open: item.status === 'open',
    crowded: item.crowded,
    movable: item.movable,
    aria: t('pm.calendar.eventAria', { date: job.planned.shown, status: t(key) }),
  };
}

const tone = (id: string): OutcomeCount['tone'] =>
  id === 'onTime' || id === 'done'
    ? 'gain'
    : id === 'overdue' || id === 'missed'
      ? 'loss'
      : id === 'early' || id === 'late'
        ? 'risk'
        : 'neutral';

function outcomes(
  counts: Record<string, number>,
  keys: [id: string, word: string][],
  t: TFunction,
): OutcomeCount[] {
  return keys.map(([id, word]) => ({
    id,
    tone: tone(id),
    text: fill(t(word), { n: count(counts[id] ?? 0) }),
  }));
}

/** The two compliance figures with every count the engine sent (v1 printed two of the twelve). */
function judgedOf(view: PmComplianceView, t: TFunction): Judged[] {
  const pm: [string, string][] = ['onTime', 'early', 'late', 'overdue', 'cancelled', 'pending'].map(
    (id) => [id, `v2p.pm.o.${id}`],
  );
  const schedule: [string, string][] = [
    ['done', 'v2p.pm.o.done'],
    ['missed', 'v2p.pm.o.missed'],
    ['pending', 'v2p.pm.o.schedulePending'],
  ];
  return [
    {
      label: t('pm.compliance.pm'),
      rate: view.empty ? '—' : rateText(view.pm.pct),
      counts: outcomes(view.pm.counts, pm, t),
    },
    {
      label: t('pm.compliance.schedule'),
      rate: view.empty ? '—' : rateText(view.schedule.pct),
      counts: outcomes(view.schedule.counts, schedule, t),
    },
  ];
}

const text = (value: string): Point[number] => ({ text: value });

/** The answer first: how PM is doing, then how many PM jobs share a day (the thing a head can act on here). */
function verdictOf(
  view: PmComplianceView | null,
  crowded: number,
  source: string,
  t: TFunction,
): VerdictData {
  const judged = view !== null && !view.empty;
  const rates: Point = judged
    ? [
        {
          text: fill(t('v2p.pm.headline'), {
            pm: rateText(view.pm.pct),
            schedule: rateText(view.schedule.pct),
          }),
          tone: 'strong',
        },
      ]
    : [text(t('v2p.pm.noHeadline'))];
  const spread: Point =
    crowded === 0
      ? [text(t('v2p.pm.calm'))]
      : [{ text: fill(t('v2p.pm.crowded'), { n: count(crowded) }), tone: 'risk' }];
  const why: Point[] = judged
    ? [
        [
          text(
            t('pm.compliance.pmCounts', {
              onTime: view.pm.counts.onTime,
              eligible: view.pm.counts.eligible,
            }),
          ),
        ],
        [
          text(
            t('pm.compliance.scheduleCounts', {
              done: view.schedule.counts.done,
              eligible: view.schedule.counts.eligible,
            }),
          ),
        ],
        [text(t('pm.compliance.window', { from: shortDate(view.from), to: shortDate(view.to) }))],
      ]
    : [[text(t(view === null ? 'pm.calendar.noFigure' : 'pm.compliance.empty'))]];
  return { headline: [...rates, text(' '), ...spread], why, context: source };
}

function figuresOf(
  view: PmComplianceView | null,
  load: { jobs: number; days: number; crowded: number; crowdedDays: number; cap: number },
  t: TFunction,
): FigureData[] {
  const tile = (id: string, label: string, pct: number | null, sub: string): FigureData => ({
    id,
    label,
    value: view === null || view.empty ? '—' : rateText(pct),
    sub: view === null ? t('pm.calendar.noFigure') : view.empty ? t('pm.compliance.empty') : sub,
  });
  return [
    tile(
      'pm',
      t('pm.compliance.pm'),
      view?.pm.pct ?? null,
      t('pm.compliance.pmCounts', {
        onTime: view?.pm.counts.onTime,
        eligible: view?.pm.counts.eligible,
      }),
    ),
    tile(
      'schedule',
      t('pm.compliance.schedule'),
      view?.schedule.pct ?? null,
      t('pm.compliance.scheduleCounts', {
        done: view?.schedule.counts.done,
        eligible: view?.schedule.counts.eligible,
      }),
    ),
    {
      id: 'crowded',
      label: t('v2p.pm.crowdedFigure'),
      value: count(load.crowded),
      sub:
        load.crowded === 0
          ? t('v2p.pm.calmSub')
          : fill(t('v2p.pm.crowdedSub'), { days: count(load.crowdedDays) }),
    },
    {
      id: 'jobs',
      label: t('v2p.pm.jobsFigure'),
      value: count(load.jobs),
      sub: t('pm.calendar.cap', { cap: load.cap }),
    },
  ];
}

/**
 * The PM calendar's model from the calendar reply and the compliance figure: every figure is the engine's, every
 * word the reader's. The grid's six weeks are the reply's own range; the keyboard list is for the month the grid
 * shows. An empty range is still a calendar (the reader can move to the next month), so this never returns null.
 */
export function pmCalendarModel(input: PmCalendarInput, t: TFunction): PmCalendarModel {
  const { calendar, asOf, canMove } = input;
  const view = readPmCompliance(input.compliance);
  const items = calendar.items;
  const days = loadOf(items).size;
  const crowdedItems = items.filter((item) => item.crowded);
  const crowdedDays = new Set(crowdedItems.map((item) => item.scheduledOn)).size;
  const tolerance = t('v2p.pm.tolerance');
  const jobs = items.map((item) => jobOf(item, t, { tolerance }));
  const range = { from: calendar.from, to: calendar.to };
  const month = shownMonth(range);
  const inMonth = items.filter((item) => item.scheduledOn.startsWith(month)).length;
  const words = pmCalendarWords(t, { jobs: inMonth, spread: crowdedItems.length });
  const source = fill(
    t(view === null ? 'v2p.pm.sourceNone' : 'v2p.pm.source'),
    view === null
      ? { date: shortDate(asOf) }
      : { from: shortDate(view.from), to: shortDate(view.to), date: shortDate(asOf) },
  );
  return {
    verdict: verdictOf(view, crowdedItems.length, source, t),
    figures: figuresOf(
      view,
      {
        jobs: items.length,
        days,
        crowded: crowdedItems.length,
        crowdedDays,
        cap: calendar.cap,
      },
      t,
    ),
    judged: view === null || view.empty ? [] : judgedOf(view, t),
    range,
    month,
    today: calendar.today,
    events: items.map((item, at) => eventOf(item, jobs[at]!, t)),
    jobs,
    spread: jobs.filter((job) => job.crowded),
    monthJobs: jobs.filter((job) => job.planned.iso.startsWith(month)),
    canMove,
    calendarSub: fill(t(canMove ? 'v2p.pm.cal.sub' : 'v2p.pm.cal.subRead'), {
      count: count(items.length),
      days: count(days),
    }),
    spreadSub: t('pm.calendar.spread.hint', { count: crowdedDays }),
    source,
    words,
  };
}
