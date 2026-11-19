import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PmCalendarItem } from '@uptimo/shared';
import { Button } from '../../ui/button.js';
import { Card } from '../../ui/card.js';
import { CalendarCheck, CalendarClock } from '../../ui/icon.js';
import { StatusChip } from '../../ui/elements/index.js';
import { Input, Label } from '../../ui/input.js';
import { Sheet } from '../../ui/sheet.js';
import { displayDay } from './machine-values.js';

/**
 * The keyboard way to move a job (ticket 87, R10): the calendar's drag has no keyboard, so every job the head may
 * move is also listed here with a "Move to date" button. The button opens the shared sheet with a native date
 * field; Enter confirms, Escape cancels, focus comes back to the job's button, and the page's status line says
 * where the job landed. The server still decides every date (Sunday, the past, the tolerance): its refusal is
 * read out inside the sheet, which hides the page behind it from a screen reader.
 */

/** ARIA's word for a control that opens a dialog. */
const POPUP = 'dialog';

/** A tile's identity: the machine, which survives the first move turning a plan occurrence into a ticket. */
export const jobKey = (item: PmCalendarItem): string => item.machineId;

type MoveFn = (item: PmCalendarItem, target: string) => Promise<boolean>;

/**
 * One confirm: an empty date is refused here and never reaches the server; the sheet closes only when the server
 * accepted the day, so a refusal leaves it open with the reason in view.
 */
export async function confirmMove(
  move: MoveFn,
  item: PmCalendarItem,
  target: string,
  close: () => void,
): Promise<boolean> {
  if (target === '') return false;
  const moved = await move(item, target);
  if (moved) close();
  return moved;
}

/** The sheet's body: one date field and the confirm button; the date starts on the job's own day. */
export function MoveForm({
  item,
  pending,
  refusal,
  onMove,
}: {
  item: PmCalendarItem;
  pending: boolean;
  refusal: string | null;
  onMove: MoveFn;
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState(item.scheduledOn);
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (date === '') return;
    void onMove(item, date);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-footnote text-neutral-600">
        {t('pm.calendar.moveSheet.now', { date: displayDay(item.scheduledOn) })}
      </p>
      <Label htmlFor="pm-move-date">{t('pm.calendar.moveSheet.label')}</Label>
      <Input
        id="pm-move-date"
        type="date"
        value={date}
        required
        onChange={(event) => setDate(event.target.value)}
      />
      {refusal === null ? null : (
        <p role="alert" className="text-body font-medium text-bad-ink">
          {refusal}
        </p>
      )}
      <Button type="submit" disabled={pending || date === ''}>
        {t('pm.calendar.moveSheet.confirm')}
      </Button>
    </form>
  );
}

/** One job as a tile: its code and day, the words for its state, and the Move to date button. */
function JobTile({ item, onOpen }: { item: PmCalendarItem; onOpen: () => void }) {
  const { t } = useTranslation();
  const open = item.status === 'open';
  return (
    <li data-job={item.machineCode}>
      <Card>
        <span className="text-body font-semibold">{item.machineCode}</span>
        <span className="text-footnote text-neutral-600">{displayDay(item.scheduledOn)}</span>
        <span>
          <StatusChip tone="neutral" icon={open ? CalendarClock : CalendarCheck}>
            {t(open ? 'pm.calendar.legend.open' : 'pm.calendar.legend.planned')}
          </StatusChip>
        </span>
        <Button
          // eslint-disable-next-line i18next/no-literal-string -- a variant value, not copy
          variant="secondary"
          aria-haspopup={POPUP}
          data-job-button={jobKey(item)}
          aria-label={t('pm.calendar.moveDateFor', { machine: item.machineCode })}
          onClick={onOpen}
        >
          {t('pm.calendar.moveDate')}
        </Button>
      </Card>
    </li>
  );
}

/** The shared sheet with the move form for the chosen job; closed while none is chosen. */
function JobSheet({
  chosen,
  onClose,
  pending,
  refusal,
  onMove,
}: {
  chosen: PmCalendarItem | null;
  onClose: () => void;
  pending: boolean;
  refusal: string | null;
  onMove: MoveFn;
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      open={chosen !== null}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t('pm.calendar.moveSheet.title', { machine: chosen?.machineCode ?? '' })}
    >
      {chosen ? (
        <MoveForm item={chosen} pending={pending} refusal={refusal} onMove={onMove} />
      ) : null}
    </Sheet>
  );
}

/** The jobs this month's list holds: movable ones whose day is in the shown month (YYYY-MM), not the grid's edge days. */
export const jobsOf = (items: readonly PmCalendarItem[], month: string): PmCalendarItem[] =>
  items.filter((item) => item.movable && item.scheduledOn.startsWith(month));

/**
 * What the shared sheet does not do: when the sheet has closed (Escape, cancel or a landed move) focus goes back to the
 * job's button, found by its machine so it survives a redraw (or to the list when the job left the month), and a
 * landed move is then said on the page, whose status line is hidden from a screen reader while the sheet is open.
 */
function useRestoreFocus(chosen: PmCalendarItem | null, announce: () => void) {
  const opener = useRef('');
  const wasOpen = useRef(false);
  const landed = useRef(false);
  const say = useRef(announce);
  say.current = announce;
  useEffect(() => {
    if (chosen !== null) {
      wasOpen.current = true;
      return undefined;
    }
    if (!wasOpen.current) return undefined;
    wasOpen.current = false;
    const timer = window.setTimeout(() => {
      const button = document.querySelector<HTMLElement>(`[data-job-button="${opener.current}"]`);
      (button ?? document.querySelector<HTMLElement>('[data-jobs-list]'))?.focus();
      if (landed.current) say.current();
      landed.current = false;
    }, 50);
    return () => window.clearTimeout(timer);
  }, [chosen]);
  return { opener, landed };
}

/**
 * The movable jobs of the shown month and the sheet that moves one. `move` resolves true when the server accepted the
 * day; the sheet then closes, focus goes back to that job's button and the page says where it landed.
 */
export function JobList({
  items,
  month,
  refusal,
  pending,
  move,
  announce,
}: {
  items: readonly PmCalendarItem[];
  month: string;
  refusal: string | null;
  pending: boolean;
  move: MoveFn;
  /** Says the landed day on the page; called once the sheet has closed. */
  announce: () => void;
}) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<PmCalendarItem | null>(null);
  const [attempted, setAttempted] = useState(false);
  const { opener, landed } = useRestoreFocus(chosen, announce);
  const jobs = jobsOf(items, month);
  if (jobs.length === 0) return null;
  const confirm: MoveFn = (item, target) => {
    setAttempted(true);
    // Only this job's own sheet closes: a move still in flight after Escape must not close another job's sheet.
    return confirmMove(move, item, target, () => {
      landed.current = true;
      setChosen((now) => (now !== null && jobKey(now) === jobKey(item) ? null : now));
    });
  };
  const open = (item: PmCalendarItem): void => {
    opener.current = jobKey(item);
    setAttempted(false);
    setChosen(item);
  };
  return (
    <section aria-labelledby="pm-jobs-title" className="flex flex-col gap-3">
      <h3 id="pm-jobs-title" className="text-body font-semibold">
        {t('pm.calendar.jobs.title')}
      </h3>
      <p className="text-footnote text-neutral-600">{t('pm.calendar.jobs.hint')}</p>
      <ul
        // eslint-disable-next-line i18next/no-literal-string -- a tabindex value, so the long list scrolls by keyboard
        tabIndex={0}
        data-jobs-list
        aria-label={t('pm.calendar.jobs.title')}
        className="flex max-h-96 flex-col gap-3 overflow-y-auto p-1"
      >
        {jobs.map((item) => (
          <JobTile key={jobKey(item)} item={item} onOpen={() => open(item)} />
        ))}
      </ul>
      <JobSheet
        chosen={chosen}
        onClose={() => setChosen(null)}
        pending={pending}
        refusal={attempted ? refusal : null}
        onMove={confirm}
      />
    </section>
  );
}
