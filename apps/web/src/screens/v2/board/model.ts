import type { TFunction } from 'i18next';
import type { TakeawayData, Takeaways } from '../../../ui/v2/takeaway.js';
import { formatMinutes } from '../../../components/format.js';
import type { AgeBuckets, Column, LiveBoard } from '../../board/data.js';

export type { Column } from '../../board/data.js';

/** State, config and the day score are read again every 30 s (staleTime = refetchInterval, as v1). */
export const REFETCH_MS = 30_000;
/** The TV shows the three oldest stops of a column and "and {n} more"; the phone and the desktop show every stop. */
export const TV_ROWS = 3;
/** Where "Open TV view" goes. */
export const KIOSK_URL = '/desk/board?kiosk=1';
/** The takeaway ids: the top verdict over the columns, and the line over the ages card. */
export const SECTION_IDS = ['board.stops', 'board.ages'] as const;

export type BucketKey = keyof AgeBuckets;
export type AgeTone = 'danger' | 'hold' | null;

/** `/desk/board?kiosk=1` is the wall TV. */
export interface BoardQuery {
  tv: boolean;
}

/** A nav link of the phone and desktop; `wideOnly` hides it on the phone ("Open TV view"). */
export interface BoardLink {
  to: string;
  label: string;
  wideOnly?: true;
}

/** One stopped machine as its row prints it: code, age, sub-line. `longest` marks the verdict's machine. */
export interface StopRowModel {
  /** The machine id. */
  id: string;
  code: string;
  /** The segment code, for the machine icon. */
  segment: string;
  /** "12 min", "2 h 39 min", "1 d 2 h". */
  age: string;
  ageTone: AgeTone;
  /** Segment name · cell; in the waiting column the wait reason's label · cell. */
  sub: string;
  longest: boolean;
}

export interface BoardColumn {
  column: Column;
  /** "Nobody has started" / "Being repaired" / "Paused and waiting": the h2 and the region's name. */
  title: string;
  /** The status chip: "Stopped" / "In progress" / "Waiting". */
  chip: string;
  status: 'stopped' | 'in_progress' | 'waiting';
  /** Every stop in the column, not only the rows shown. */
  count: number;
  /** Oldest first; capped at TV_ROWS on the TV. */
  rows: StopRowModel[];
  /** "and 2 more" on the TV when rows were left out, else null. */
  more: string | null;
}

export interface AgeBucket {
  key: BucketKey;
  label: string;
  count: number;
  /** Grey at 0; "Over 1 day" red when above 0; otherwise plain. */
  tone: 'muted' | 'danger' | null;
}

/** "Response today" / "Repair today": "—" when there is nothing to average (never "0 min"). */
export interface DayTile {
  id: 'response' | 'repair';
  label: string;
  value: string;
  /** "average of 6, 4 closed"; null when the count is 0 or the day score is missing. */
  note: string | null;
}

export interface BoardModel {
  tv: boolean;
  /** "Live board" (h1; screen-reader only on the TV). */
  title: string;
  /** Report, Desk, Open TV view; none at all on the TV. */
  links: BoardLink[];
  /** "Updated 10:44" in the plant's time zone. */
  updated: string;
  /** The TV's wall clock, top right; null off the TV. `day` is "Tue 24 Nov". */
  clock: { time: string; day: string } | null;
  pulse: {
    aria: string;
    running: number;
    stopped: number;
    machines: number;
    runningWord: string;
    /** "of 12 machines". */
    of: string;
    stoppedWord: string;
  };
  columns: BoardColumn[];
  ages: {
    title: string;
    /** "Open over 1 day" (the TV's big number). */
    overDayTitle: string;
    buckets: AgeBucket[];
    /** The TV's line of the other non-zero buckets: "1 to 4 h: 4 · 4 to 24 h: 1". */
    line: string;
  };
  today: DayTile[];
  /** By SECTION_IDS; null where there is nothing worth saying. */
  takeaways: Takeaways;
}

/** The nav links: none on the TV; Report (/floor), Desk (/desk), Open TV view (wide only) elsewhere. */
export function linksFor(tv: boolean, t: TFunction): BoardLink[] {
  if (tv) return [];
  return [
    { to: '/floor', label: t('nav.report') },
    { to: '/desk', label: t('nav.desk') },
    { to: KIOSK_URL, label: t('live.openTv'), wideOnly: true },
  ];
}

/** The rows a column shows: the TV_ROWS oldest on the TV, all of them elsewhere. */
export function shownRows<T>(stops: T[], tv: boolean): T[] {
  return tv ? stops.slice(0, TV_ROWS) : stops;
}

const AGE_TONE: Record<Column, AgeTone> = { notStarted: 'danger', repairing: null, waiting: 'hold' };

/** The age colour of a column: red where nobody has started, amber (hold) while waiting, plain while repaired. */
export function ageToneOf(column: Column): AgeTone {
  return AGE_TONE[column];
}

const overDayLine = (count: number, t: TFunction): string =>
  count > 0 ? t('live.take.overDay', { count }) : t('live.take.noneOverDay');

/**
 * The top verdict: "PR-02 has waited longest: 5 h 10 min with nobody started; 1 breakdown is over a day old."
 * tone loss, tag "Longest", `outlier` = that machine's id. Null when nobody waits unstarted.
 */
export function stopsTakeaway(board: LiveBoard, t: TFunction): TakeawayData | null {
  const oldest = board.columns.notStarted[0];
  if (!oldest) return null;
  const first = t('live.take.stops', {
    code: oldest.machine.code,
    age: formatMinutes(oldest.ageMin),
  });
  const over = board.ages.overDay > 0 ? `; ${overDayLine(board.ages.overDay, t)}` : '';
  return {
    text: `${first}${over}.`,
    tone: 'loss',
    tag: t('live.longest'),
    outlier: oldest.machine.id,
  };
}

/** The ages line: "1 breakdown is over a day old; 2 of 8 are under 1 h." Null when nothing is stopped. */
export function agesTakeaway(ages: AgeBuckets, t: TFunction): TakeawayData | null {
  const total = ages.underHour + ages.oneToFour + ages.fourToDay + ages.overDay;
  if (total === 0) return null;
  const tone = ages.overDay > 0 ? 'loss' : 'neutral';
  const over = overDayLine(ages.overDay, t);
  return {
    text: `${t('live.take.ages', { over, under: ages.underHour, total })}.`,
    tone,
    tag: t(`insight.tag.${tone}`),
  };
}
