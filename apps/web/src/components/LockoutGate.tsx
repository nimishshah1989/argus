import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CommandAction, CommandBody } from '../api.js';
import { ApiError, confirmLockoutThen } from '../data/index.js';
import { isGated, lockoutRefusalKey, type LockoutView } from './lockout.js';

/** The ticks on the page and the one call that confirms them and then runs the held-back action. */
export interface Gate {
  /** The person acting. */
  personId: string;
  view: LockoutView | null;
  ticks: ReadonlySet<string>;
  allTicked: boolean;
  /** The confirmation and the action are being sent. */
  busy: boolean;
  /** Why the last attempt was refused, in words. */
  refusal: string | null;
  /** The people the server says are still to confirm, when that is why it refused. */
  missing: readonly string[];
  tick: (code: string, on: boolean) => void;
  holds: (action: string) => boolean;
  /** This button is the one being sent. */
  sending: (action: string) => boolean;
  /** Confirm every step (when not yet confirmed), then run `action`. */
  run: (action: CommandAction, body: CommandBody) => Promise<boolean>;
}

/** Outside a ticket page there is no lockout: nothing is held and the action bar behaves as it always did. */
const NO_GATE: Gate = {
  personId: '',
  view: null,
  ticks: new Set(),
  allTicked: false,
  busy: false,
  refusal: null,
  missing: [],
  tick: () => undefined,
  holds: () => false,
  sending: () => false,
  run: () => Promise.resolve(false),
};

const GateContext = createContext<Gate>(NO_GATE);

export const useLockoutGate = () => useContext(GateContext);

interface Props {
  ticketId: string;
  personId: string;
  view: LockoutView | null;
  children: ReactNode;
}

export function LockoutGate({ ticketId, personId, view, children }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [ticks, setTicks] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [missing, setMissing] = useState<readonly string[]>([]);
  const steps = view?.kind === 'ticking' ? view.steps : [];
  const allTicked = steps.length > 0 && steps.every((step) => ticks.has(step.code));
  // A refetch that puts the ticket back in front of the ticks (after a pause, say) starts them empty:
  // the ticks belong to the confirmation that was just cleared, not to the one about to be made.
  const stepsKey = steps.map((step) => step.code).join('\u0000');
  const seenSteps = useRef<string | null>(steps.length > 0 ? stepsKey : null);
  useEffect(() => {
    const key = steps.length > 0 ? stepsKey : null;
    if (key !== null && seenSteps.current !== key) setTicks(new Set());
    seenSteps.current = key;
  }, [steps.length, stepsKey]);

  function tick(code: string, on: boolean) {
    const next = new Set(ticks);
    if (on) next.add(code);
    else next.delete(code);
    setTicks(next);
  }

  async function run(action: CommandAction, body: CommandBody): Promise<boolean> {
    setBusy(true);
    setRefusal(null);
    setMissing([]);
    try {
      if (view?.kind !== 'ticking') return false;
      const stepCodes = view.steps.map((step) => step.code);
      await confirmLockoutThen(ticketId, { stepCodes, action, body });
      await Promise.all(
        ['state', 'ticket', 'tickets'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      return true;
    } catch (caught) {
      const key = lockoutRefusalKey(caught);
      setRefusal(key ? t(key) : caught instanceof ApiError ? caught.message : t('lockout.offline'));
      setMissing(caught instanceof ApiError ? (caught.missing ?? []) : []);
      setTicks(new Set());
      // The steps may have been edited, or somebody else may have moved the ticket: show what is true now.
      await queryClient.invalidateQueries({ queryKey: ['ticket'] });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const gate: Gate = {
    personId,
    view,
    ticks,
    allTicked,
    busy,
    refusal,
    missing,
    tick,
    holds: (action) => isGated(view, action) && !allTicked,
    sending: (action) => busy && isGated(view, action),
    run,
  };
  return <GateContext.Provider value={gate}>{children}</GateContext.Provider>;
}
