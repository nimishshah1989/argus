import { useRef, useState } from 'react';
import { reopenNudge, writeNudge } from '../../../api.js';
import type { ActionCenterActions } from './model.js';

/** One write to one nudge, named by the engine's own key (never the address-bar ref or a machine code). */
export type NudgeWrite =
  | { action: 'ack'; key: string; owner: string; due: string; note: string }
  | { action: 'snooze' | 'resolved'; key: string }
  | { action: 'reopen'; key: string };

/**
 * What v1 sent for each write: acknowledge, snooze and resolve are `PUT /analytics/action-center/nudges/:key` with the
 * screen's word for the status (`resolved`, which the route stores as `done`); reopen is `DELETE` on the same address.
 * The server decides who may; it answers the whole fresh board.
 */
export function sendOf(write: NudgeWrite): () => Promise<unknown> {
  if (write.action === 'reopen') return () => reopenNudge(write.key);
  if (write.action === 'ack') {
    const { key, owner, due, note } = write;
    return () => writeNudge(key, { status: 'ack', owner, due, note });
  }
  return () => writeNudge(write.key, { status: write.action });
}

/**
 * The writes, one at a time. The page is told while one is on its way, and which nudge's write failed, so a failure on
 * one nudge is never shown on another. When the server answers, `afterwards` reads the board again through the live
 * reader.
 */
export function useNudgeWrites(afterwards: () => void): Required<ActionCenterActions> {
  const [state, setState] = useState<{ saving: boolean; failedKey: string | null }>({
    saving: false,
    failedKey: null,
  });
  const busy = useRef(false);
  const latest = useRef(afterwards);
  latest.current = afterwards;
  const run = (write: NudgeWrite) => {
    if (busy.current) return;
    busy.current = true;
    setState({ saving: true, failedKey: null });
    sendOf(write)().then(
      () => {
        busy.current = false;
        setState({ saving: false, failedKey: null });
        latest.current();
      },
      () => {
        busy.current = false;
        setState({ saving: false, failedKey: write.key });
      },
    );
  };
  return {
    saving: state.saving,
    failedKey: state.failedKey,
    onAck: (key, body) => run({ action: 'ack', key, ...body }),
    onSnooze: (key) => run({ action: 'snooze', key }),
    onResolve: (key) => run({ action: 'resolved', key }),
    onReopen: (key) => run({ action: 'reopen', key }),
  };
}
