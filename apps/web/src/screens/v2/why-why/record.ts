import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { WhyWhyPayload, WhyWhyWrite } from '@uptimo/shared/why-why';
import { canAnalytics, type ActorContext, type Role } from '@uptimo/domain';
import { getWhyWhy, saveWhyWhy } from '../../../api.js';
import { downloadFile } from '../../../data/index.js';
import type { WhyWhyRow } from './model.js';

/** The signed-in login, as far as the Why-Why writes read it. */
export interface Viewer {
  role: string;
  id: string;
  name: string;
  actingPersonId: string;
  shared: boolean;
  cell?: string | null;
  actingPerson?: { name: string } | null;
}

/** The signed-in person, as the server names them beside the record it will write. */
export function shownName(user: Viewer | undefined): string {
  return user === undefined ? '' : (user.actingPerson?.name ?? user.name);
}

/** R3's write guard, read from the same predicate the Why-Why routes use: only the analytics roles save. */
export function mayWrite(user: Viewer | undefined): boolean {
  if (user === undefined) return false;
  const actor: ActorContext = {
    role: user.role as Role,
    loginId: user.id,
    personId: user.actingPersonId || null,
    shared: user.shared,
    cell: user.cell ?? null,
  };
  return canAnalytics(actor);
}

/** The row whose Why-Why is open: its own ticket (sent to the server, never printed) and the saved record, if any. */
export type Choice = {
  ticketId: string;
  machine: string;
  date: string;
  printedDate: string;
  completed: boolean;
  record: WhyWhyPayload | null;
};

/**
 * The screen's own state: which row is open, the save, and the saved record's PDF. A row acts on the ticket the engine
 * printed beside it. After a save the figures are read again, so the row says Completed without a reload.
 */
export function useWhyWhyRecord() {
  const client = useQueryClient();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const save = useMutation({
    mutationFn: (input: { ticketId: string; body: WhyWhyWrite }) =>
      saveWhyWhy(input.ticketId, input.body),
    onSuccess: async (record, input) => {
      setFailure(null);
      setChoice((current) =>
        current !== null && current.ticketId === input.ticketId
          ? { ...current, completed: true, record }
          : current,
      );
      await client.invalidateQueries({ queryKey: ['analytics-figures'] });
    },
    onError: () => setFailure('analytics.whyWhy.saveFailed'),
  });
  const open = async (row: WhyWhyRow) => {
    save.reset();
    setFailure(null);
    if (row.ticketId === null) return;
    const base = {
      ticketId: row.ticketId,
      machine: row.machine.label,
      date: row.date.shown,
      printedDate: row.date.printed,
      completed: row.status.done,
    };
    if (!row.status.done) {
      setChoice({ ...base, record: null });
      return;
    }
    try {
      setChoice({ ...base, record: await getWhyWhy(row.ticketId) });
    } catch {
      setFailure('analytics.whyWhy.loadFailed');
    }
  };
  const pdf = async () => {
    if (choice === null) return;
    setFailure(null);
    try {
      await downloadFile(
        `/api/v1/tickets/${encodeURIComponent(choice.ticketId)}/why-why.pdf`,
        `WhyWhy_${choice.machine}_${choice.printedDate}.pdf`,
      );
    } catch {
      setFailure('analytics.whyWhy.pdfFailed');
    }
  };
  const close = () => {
    save.reset();
    setChoice(null);
  };
  return { choice, failure, save, open, pdf, close };
}
