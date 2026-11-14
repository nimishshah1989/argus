/**
 * What each kind of message says. A row stores the kind and ids only; the words are chosen here, at send time.
 * Rich text (ticket ref, machine code) would need `tickets`, which this module may not call, so a push names the
 * ticket by id and the app shows the details when it opens.
 */
export const KINDS = {
  'breakdown.new': 'New breakdown',
  'complaint.fixed': 'Complaint fixed',
  'handback.disputed': 'Fix sent back',
  'push.test': 'Push works',
} as const;

export type NotifyKind = keyof typeof KINDS;

export interface PushPayload {
  title: string;
  body: string;
  kind: string;
  ticketId?: string;
}

export function pushPayload(kind: string, ticketId: string | null): PushPayload {
  const body = kind in KINDS ? KINDS[kind as NotifyKind] : 'A ticket changed.';
  return { title: 'UPTIMO', body, kind, ...(ticketId ? { ticketId } : {}) };
}
