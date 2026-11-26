import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CommandAction, CommandBody } from '../../../api.js';
import { ApiError, confirmLockoutThen } from '../../../data/index.js';
import { isGated, lockoutRefusalKey, type LockoutView } from '../../../components/lockout.js';

/** The ticks on the page and the one call that confirms them and then runs the held-back action. */
export interface Gate {
  /** The person acting. */
  personId: string;
  view: LockoutView | null;
  ticks: ReadonlySet<string>;
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
  /** The last refusal no longer applies: the command it was about has now run. */
  clearRefusal: () => void;
}

/** Outside a ticket page there is no lockout: the action bar is only rendered under `LockoutGate`. */
const GateContext = createContext<Gate | null>(null);

/** Refreshes the replies a command changes, in parallel. */
const refresh = (client: QueryClient, keys: string[]) =>
  Promise.all(keys.map((key) => client.invalidateQueries({ queryKey: [key] })));

export function useLockoutGate(): Gate {
  const gate = useContext(GateContext);
  if (!gate) throw new Error('useLockoutGate is only for the ticket page');
  return gate;
}

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
  // A refetch that puts the steps back in front of the person (after a pause, say) starts them unticked.
  const stepsKey = steps.map((step) => step.code).join('\u0000');
  useEffect(() => {
    if (stepsKey) setTicks(new Set());
  }, [stepsKey]);

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
      await refresh(queryClient, ['state', 'ticket', 'tickets']);
      return true;
    } catch (caught) {
      const key = lockoutRefusalKey(caught);
      setRefusal(key ? t(key) : caught instanceof ApiError ? caught.message : t('lockout.offline'));
      setMissing(caught instanceof ApiError ? (caught.missing ?? []) : []);
      setTicks(new Set());
      // The steps may have been edited, or somebody else may have moved the ticket: show what is true now.
      await refresh(queryClient, ['ticket']);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const gate: Gate = {
    personId,
    view,
    ticks,
    busy,
    refusal,
    missing,
    tick,
    holds: (action) => isGated(view, action) && !allTicked,
    sending: (action) => busy && isGated(view, action),
    run,
    clearRefusal: () => {
      setRefusal(null);
      setMissing([]);
    },
  };
  return <GateContext.Provider value={gate}>{children}</GateContext.Provider>;
}
