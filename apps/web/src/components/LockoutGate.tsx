import { createContext, useContext, useState, type ReactNode } from 'react';
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
  const steps = view?.kind === 'ticking' ? view.steps : [];
  const allTicked = steps.length > 0 && steps.every((step) => ticks.has(step.code));

  function tick(code: string, on: boolean) {
    const next = new Set(ticks);
    if (on) next.add(code);
    else next.delete(code);
    setTicks(next);
  }

  async function run(action: CommandAction, body: CommandBody): Promise<boolean> {
    setBusy(true);
    setRefusal(null);
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
    tick,
    holds: (action) => isGated(view, action) && !allTicked,
    sending: (action) => busy && isGated(view, action),
    run,
  };
  return <GateContext.Provider value={gate}>{children}</GateContext.Provider>;
}
