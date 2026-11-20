import { useRef, useState } from 'react';
import { reopenNudge, writeNudge } from '../../../api.js';
import type { ActionCenterActions } from './model.js';

/**
 * The four writes v1 sent, with the server deciding who may: one at a time, the page told while one is on its way and
 * when one failed. When the server answers, `afterwards` reads the board again through the live reader.
 */
export function useNudgeWrites(afterwards: () => void): Required<ActionCenterActions> {
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle');
  const busy = useRef(false);
  const latest = useRef(afterwards);
  latest.current = afterwards;
  const run = (send: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true;
    setState('saving');
    send()
      .then(
        () => {
          setState('idle');
          latest.current();
        },
        () => setState('failed'),
      )
      .finally(() => {
        busy.current = false;
      });
  };
  return {
    saving: state === 'saving',
    failed: state === 'failed',
    onAck: (key, body) => run(() => writeNudge(key, { status: 'ack', ...body })),
    onSnooze: (key) => run(() => writeNudge(key, { status: 'snooze' })),
    onResolve: (key) => run(() => writeNudge(key, { status: 'resolved' })),
    onReopen: (key) => run(() => reopenNudge(key)),
  };
}
