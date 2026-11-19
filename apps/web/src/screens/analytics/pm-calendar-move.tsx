import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PmCalendarItem } from '@uptimo/shared';
import { Button } from '../../ui/button.js';
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

const keyOf = (item: PmCalendarItem): string => item.ticketId ?? item.planId ?? item.machineId;

/** The sheet's body: one date field and the confirm button; the date starts on the job's own day. */
function MoveForm({
  item,
  pending,
  refusal,
  onMove,
}: {
  item: PmCalendarItem;
  pending: boolean;
  refusal: string | null;
  onMove: (item: PmCalendarItem, target: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState(item.scheduledOn);
  const [tried, setTried] = useState(false);
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (date === '') return;
    setTried(true);
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
      {!tried || refusal === null ? null : (
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
    <li
      data-job={item.machineCode}
      className="flex flex-col gap-2 rounded-tile border-l-4 border-neutral-fill bg-surface p-3 shadow-card"
    >
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
        aria-label={t('pm.calendar.moveDateFor', { machine: item.machineCode })}
        onClick={onOpen}
      >
        {t('pm.calendar.moveDate')}
      </Button>
    </li>
  );
}

/**
 * The movable jobs of the month and the sheet that moves one. `move` resolves true when the server accepted the day;
 * the sheet then closes and Radix hands focus back to the job's button.
 */
export function JobList({
  items,
  refusal,
  pending,
  move,
}: {
  items: readonly PmCalendarItem[];
  refusal: string | null;
  pending: boolean;
  move: (item: PmCalendarItem, target: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<PmCalendarItem | null>(null);
  const jobs = items.filter((item) => item.movable);
  if (jobs.length === 0) return null;
  const confirm = async (item: PmCalendarItem, target: string): Promise<boolean> => {
    const moved = await move(item, target);
    if (moved) setChosen(null);
    return moved;
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
        aria-label={t('pm.calendar.jobs.title')}
        className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto p-1"
      >
        {jobs.map((item) => (
          <JobTile key={keyOf(item)} item={item} onOpen={() => setChosen(item)} />
        ))}
      </ul>
      <Sheet
        open={chosen !== null}
        onOpenChange={(open) => (open ? undefined : setChosen(null))}
        title={t('pm.calendar.moveSheet.title', { machine: chosen?.machineCode ?? '' })}
      >
        {chosen ? (
          <MoveForm item={chosen} pending={pending} refusal={refusal} onMove={confirm} />
        ) : null}
      </Sheet>
    </section>
  );
}
