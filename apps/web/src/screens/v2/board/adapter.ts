import type { TFunction } from 'i18next';
import type { BoardToday, Config, State } from '../../../api.js';
import { formatMinutes, formatTime } from '../../../components/format.js';
import { statusMeaning } from '../../../ui/meaning.js';
import type { StatusId } from '../../../ui/status/index.js';
import { COLUMNS, liveBoard, type Stop } from '../../board/data.js';
import {
  ageToneOf,
  agesTakeaway,
  linksFor,
  shownRows,
  stopsTakeaway,
  type AgeBucket,
  type BoardColumn,
  type BoardModel,
  type BucketKey,
  type Column,
  type DayTile,
} from './model.js';

/** What the board reads: `/state`, `/config` and `/board/today` (missing while it loads or when it is refused). */
export interface BoardInput {
  state: State;
  config: Config;
  today: BoardToday | undefined;
  tv: boolean;
}

/** Each column wears the status of its breakdowns. */
const STATUS: Record<Column, StatusId<'ticket'>> = {
  notStarted: 'stopped',
  repairing: 'in_progress',
  waiting: 'waiting',
};
const BUCKETS: BucketKey[] = ['underHour', 'oneToFour', 'fourToDay', 'overDay'];

/** "Tue 24 Nov" in the plant's time zone. */
export function dayLabel(iso: string, timeZone?: string): string {
  const day = { weekday: 'short', day: 'numeric', month: 'short', timeZone } as const;
  return new Intl.DateTimeFormat('en-GB', day).format(new Date(iso)).replace(',', '');
}

/** The sub-line: segment name · cell; in the waiting column the wait reason's label · cell. */
function subline(stop: Stop, column: Column, config: Config): string {
  const code = stop.ticket.waitReason;
  const first =
    column === 'waiting'
      ? ((config.lists.wait_reason ?? []).find((item) => item.code === code)?.label ?? code)
      : config.segments.find((s) => s.id === stop.machine.segment_id)?.name;
  return [first, stop.machine.cell].filter(Boolean).join(' · ');
}

/** A day tile: a dash and no note when there is nothing to average (never "0 min"). */
function dayTile(
  t: TFunction,
  id: DayTile['id'],
  [min, count, closed]: [number | null | undefined, number | undefined, number | undefined],
): DayTile {
  const some = count !== undefined && count > 0;
  return {
    id,
    label: t(`live.today.${id}`),
    value: some ? formatMinutes(min) : '—',
    note: some ? t('live.today.average', { count, closed }) : null,
  };
}

function columnsOf(
  board: ReturnType<typeof liveBoard>,
  config: Config,
  [tv, longestId]: [boolean, string | undefined],
  t: TFunction,
): BoardColumn[] {
  return COLUMNS.map((column) => {
    const all = board.columns[column];
    const rows = shownRows(all, tv).map((stop) => ({
      id: stop.machine.id,
      code: stop.machine.code,
      segment: config.segments.find((s) => s.id === stop.machine.segment_id)?.code ?? '',
      age: formatMinutes(stop.ageMin),
      ageTone: ageToneOf(column),
      sub: subline(stop, column, config),
      longest: column === 'notStarted' && stop.machine.id === longestId,
    }));
    return {
      column,
      title: t(`live.column.${column}`),
      chip: t(statusMeaning({ group: 'ticket', id: STATUS[column] }).label),
      status: STATUS[column] as BoardColumn['status'],
      count: all.length,
      rows,
      more: all.length > rows.length ? t('live.more', { count: all.length - rows.length }) : null,
    };
  });
}

/** "Longest PR-02, 5 h 10 min": the oldest stop nobody has started, or null. */
function longestLine(board: ReturnType<typeof liveBoard>, t: TFunction): string | null {
  const oldest = board.columns.notStarted[0];
  return oldest
    ? t('live.kpi.longest', { code: oldest.machine.code, age: formatMinutes(oldest.ageMin) })
    : null;
}

/** The replies → the board's model, through `liveBoard()` of `screens/board/data.ts` (kept, not copied). */
export function boardModel({ state, config, today, tv }: BoardInput, t: TFunction): BoardModel {
  const board = liveBoard(config, state.open, state.now);
  const timeZone = config.timeZone ?? undefined;
  const stops = stopsTakeaway(board, t);
  const time = formatTime(state.now, timeZone);
  const columns = columnsOf(board, config, [tv, stops?.outlier ?? undefined], t);
  const buckets: AgeBucket[] = BUCKETS.map((key) => ({
    key,
    label: t(`live.ages.${key}`),
    count: board.ages[key],
    tone: board.ages[key] === 0 ? 'muted' : key === 'overDay' ? 'danger' : null,
  }));
  return {
    tv,
    title: t('board.title'),
    links: linksFor(tv, t),
    updated: t('board.updated', { time }),
    clock: tv ? { time, day: dayLabel(state.now, timeZone) } : null,
    pulse: {
      aria: t('live.pulse.aria'),
      running: board.running,
      stopped: board.stopped,
      machines: board.machines,
      runningWord: t('live.pulse.running'),
      of: t('live.pulse.of', { count: board.machines }),
      stoppedWord: t('live.pulse.stopped'),
      runningLabel: t('status.ticket.running'),
      stoppedLabel: t('status.ticket.stopped'),
      share:
        board.machines > 0
          ? t('live.kpi.of', {
              count: board.machines,
              pct: Math.round((board.running / board.machines) * 100),
            })
          : t('live.pulse.of', { count: 0 }),
      split: t('live.kpi.split', {
        notStarted: board.columns.notStarted.length,
        repairing: board.columns.repairing.length,
        waiting: board.columns.waiting.length,
      }),
      longest: longestLine(board, t),
    },
    columns,
    ages: {
      title: t('live.ages.title'),
      overDayTitle: t('live.ages.overDayTitle'),
      buckets,
      line: buckets
        .slice(0, 3)
        .filter((b) => b.count > 0)
        .map((b) => t('live.ages.line', { label: b.label, count: b.count }))
        .join(' · '),
    },
    today: [
      dayTile(t, 'response', [today?.responseMin, today?.responseCount, today?.responseClosed]),
      dayTile(t, 'repair', [today?.repairMin, today?.repairCount, today?.repairClosed]),
    ],
    takeaways: { 'board.stops': stops, 'board.ages': agesTakeaway(board.ages, t) },
  };
}
