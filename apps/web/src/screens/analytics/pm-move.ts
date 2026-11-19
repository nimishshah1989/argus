import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { PmCalendarItem } from '@uptimo/shared';
import { schedulePm } from '../../api.js';
import { ApiError, idempotencyKey } from '../../data/index.js';
import type { PmMove } from './PmCalendar.js';
import { moveKeys } from './pm-calendar-view.js';
import { displayDay } from './machine-values.js';

/** One job and the day asked for, as the move writes it. */
const moveOf = (item: PmCalendarItem, target: string): PmMove => ({
  planId: item.planId,
  machineId: item.machineId,
  machineCode: item.machineCode,
  ticketId: item.ticketId,
  scheduledOn: target,
});

/** The move the grid and the panel share: one write, one refusal line, one status line. */
export function usePmMove() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [refusal, setRefusal] = useState<string | null>(null);
  const [moved, setMoved] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const keys = useRef(moveKeys(idempotencyKey)).current;
  const move = async (request: PmMove): Promise<void> => {
    setRefusal(null);
    setMoved(null);
    setPending(true);
    try {
      // `machineCode` is the status line's; the strict reschedule body carries only the ids and the day.
      const body = {
        machineId: request.machineId,
        planId: request.planId,
        ticketId: request.ticketId,
        scheduledOn: request.scheduledOn,
      };
      const reply = await schedulePm(body, keys.keyFor(body));
      keys.settled();
      await Promise.all([
        client.invalidateQueries({ queryKey: ['pm-calendar'] }),
        client.invalidateQueries({ queryKey: ['tickets'] }),
        client.invalidateQueries({ queryKey: ['analytics-figures'] }),
      ]);
      setMoved(
        t('pm.calendar.moved', {
          machine: request.machineCode,
          date: displayDay(reply.scheduledOn),
        }),
      );
    } catch (error) {
      // A refusal is the server's answer, so the next try is a new attempt; a dropped connection retries the same key.
      if (error instanceof ApiError) keys.settled();
      setRefusal(error instanceof ApiError ? error.message : t('pm.calendar.refused'));
      throw error;
    } finally {
      setPending(false);
    }
  };
  const moveItem = (item: PmCalendarItem, target: string): void => {
    void move(moveOf(item, target)).catch(() => undefined);
  };
  /** The keyboard move: true when the server took the day, false on its refusal (already worded in `refusal`). */
  const moveJob = async (item: PmCalendarItem, target: string): Promise<boolean> => {
    try {
      await move(moveOf(item, target));
      return true;
    } catch {
      return false;
    }
  };
  return { refusal, moved, pending, move, moveItem, moveJob };
}
