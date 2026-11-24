import type { CalendarEvent, CalendarRange } from '../../../ui/v2/domain/calendar-events.js';
import type { TableWords } from '../../../ui/v2/data-table.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { Drill } from '../../../ui/v2/drill.js';
import type { FigureData } from '../../../ui/v2/figure-tile.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** What a move names: the ids the server's write takes. They are handles, never printed. */
export type JobHandle = {
  machineId: string;
  planId: string | null;
  ticketId: string | null;
};

/** One day, as it prints (`DD-MMM-YYYY`), as the server's `YYYY-MM-DD` and as a number that sorts. */
export type Day = { shown: string; iso: string; value: number };

/** One machine's PM, as the engine placed it. Every printed value is the engine's own. */
export type PmJob = {
  id: string;
  machine: EntityChipProps;
  /** The plan's or the open job's own title. */
  title: string;
  planned: Day;
  due: Day;
  tolerance: { shown: string; value: number };
  /** `planned`: the plan's next due; `open`: a PM job already raised for it. */
  status: 'planned' | 'open';
  statusWord: string;
  crowded: boolean;
  /** A started job is not movable, and nobody but a head or an admin may move one. */
  movable: boolean;
  /** The nearest free working day inside its tolerance, when the engine found one. */
  suggested: (Day & { moveLabel: string; text: string }) | null;
  /** Said to a screen reader on the button that opens the keyboard move. */
  moveAria: string;
  handle: JobHandle;
};

/** The two compliance figures' counts, as pills: a word and the engine's count. */
export type OutcomeCount = { id: string; text: string; tone: 'gain' | 'loss' | 'risk' | 'neutral' };
export type Judged = {
  /** `PM compliance` or `Schedule compliance`. */
  label: string;
  /** `25.0 %`, or a dash when nothing was judged. */
  rate: string;
  counts: OutcomeCount[];
};

export type PmCalendarWords = {
  why: string;
  calendar: { title: string; loading: string; empty: string; today: string };
  legend: { label: string; planned: string; open: string; crowded: string };
  judged: { title: string; sub: string; none: string; noFigure: string };
  spread: TableWords & {
    columns: { machine: string; planned: string; free: string; action: string };
    noFreeDay: string;
  };
  jobs: TableWords & {
    sub: string;
    columns: {
      machine: string;
      job: string;
      planned: string;
      due: string;
      tolerance: string;
      status: string;
      action: string;
    };
    filters: { all: string; crowded: string; open: string; planned: string };
    moveDate: string;
  };
  move: {
    /** `{machine}`. */
    title: string;
    /** `{date}`. */
    now: string;
    label: string;
    confirm: string;
    cancel: string;
    saving: string;
    /** Said when a move is sent while no day is typed. */
    needDate: string;
    /** `{machine}` and `{date}`: the line that says where a landed move went. */
    moved: string;
    /** The server's refusal carries its own words; this is for a refusal with none. */
    refused: string;
    /** Said when the connection is down: the same move may be pressed again. */
    offline: string;
  };
};

/** Everything the PM calendar prints, in the reader's words, ready to print, for one stretch of the calendar. */
export type PmCalendarModel = {
  verdict: VerdictData;
  /** ADR 0035: `calendar`, `judged`, `spread`, `jobs`; the calendar's over every day of the reply's range, not the month. */
  takeaways?: Takeaways;
  figures: FigureData[];
  judged: Judged[];
  /** The six weeks (or the month, until the grid has said) these jobs are for. */
  range: CalendarRange;
  /** `YYYY-MM`: the month the grid shows, which the keyboard list is for. */
  month: string;
  /** The plant's today, where the grid first opens. */
  today: string;
  events: CalendarEvent[];
  /** Every PM in the range, in day order. */
  jobs: PmJob[];
  /** The ones on a crowded day. */
  spread: PmJob[];
  /** The ones a head can move, in the shown month: the keyboard way to move them. */
  monthJobs: PmJob[];
  /** True for head and admin only; the server refuses everyone else whatever the screen hides. */
  canMove: boolean;
  /** One line under the calendar's title: how many PM jobs on how many days, and whether a drag works. */
  calendarSub: string;
  /** One line under the spread table's title: how many days hold more than one PM. */
  spreadSub: string;
  /** The rows behind the compliance figure: a control of the page, as v1's "See the rows", only when the engine named rows. */
  drill: Drill | null;
  source: string;
  words: PmCalendarWords;
};

/**
 * What a screen asks the seam for: the grid's range once it has said it, `null` for the plant's own month. `canMove` is
 * the gallery's: the live reader asks the signed-in role instead, so a screen never says who may write.
 */
export type PmCalendarQuery = { range: CalendarRange | null; canMove?: boolean };

/** What a move asks of the server, with the machine's code only for the line that says where it landed. */
export type PmMoveRequest = JobHandle & { machineCode: string; scheduledOn: string };
