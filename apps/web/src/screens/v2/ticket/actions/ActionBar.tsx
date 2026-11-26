/* eslint-disable i18next/no-literal-string -- icon names and keys only; every visible string goes through t() */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionCrewMember, ActorContext } from '@uptimo/domain';
import type { CommandAction, CommandBody, Config, Ticket } from '../../../../api.js';
import { actionSpecs, type ActionSpec } from '../../../../components/actionSpecs.js';
import { isGated } from '../../../../components/lockout.js';
import { Icon } from '../../../../ui/v2/icons.js';
import { Notice } from '../../../../ui/v2/notice.js';
import { useLockoutGate } from '../LockoutGate.js';
import { ActionForm } from './ActionForm.js';
import { DoneSheet, NoReportSheet } from './closeSheets.js';

const FORM_ACTIONS = new Set<CommandAction>([
  'pause',
  'update',
  'transfer',
  'cancel',
  'join',
  'leave',
]);

interface Props {
  ticket: Ticket;
  config: Config;
  personId: string;
  actor: ActorContext;
  crew: ActionCrewMember[];
  error: string | null;
  pending: boolean;
  onRun: (action: CommandAction, body: CommandBody) => Promise<boolean>;
  /** Write report and close opens the two full screens, which the detail screen owns. */
  onWriteReport: () => void;
}

/** The one filled button is the primary action; Cancel is a quiet button in the loss colour. */
function classOf(spec: ActionSpec): string {
  if (spec.action === 'cancel') return 'v2-btn v2-btn-ghost v2-action-danger';
  return spec.primary ? 'v2-btn v2-btn-primary' : 'v2-btn v2-btn-ghost';
}

/** The busy line says which gated action is being sent, not always "starting". */
const CONFIRMING: Record<string, string> = {
  start: 'lockout.confirmingStart',
  resume: 'lockout.confirmingResume',
  join: 'lockout.confirmingJoin',
};

/** One action button; on a flagged ticket Start, Resume and Join wait for the ticks. */
function ActionButton(props: { spec: ActionSpec; disabled: boolean; onClick: () => void }) {
  const { spec, disabled, onClick } = props;
  const { t } = useTranslation();
  const gate = useLockoutGate();
  const held = gate.holds(spec.action);
  const sending = gate.sending(spec.action);
  const confirming = CONFIRMING[spec.action] ?? 'lockout.confirming';
  return (
    <button
      type="button"
      className={classOf(spec)}
      disabled={disabled || (gate.busy && !sending) || held}
      aria-busy={sending}
      onClick={() => !gate.busy && onClick()}
    >
      {sending ? (
        <>
          <Icon name="clock" size={18} />
          {t(confirming)}
        </>
      ) : (
        t(spec.label)
      )}
    </button>
  );
}

/** A held Start, Resume or Join says why under the bar: how many ticks it waits for (the i18n key and count). */
function tickHintOf(
  gate: ReturnType<typeof useLockoutGate>,
  specs: ActionSpec[],
): { count: number } | null {
  if (gate.view?.kind !== 'ticking' || !specs.some((spec) => gate.holds(spec.action))) return null;
  return { count: gate.view.steps.length };
}

/** Only the actions the server will accept for this actor (domain `availableActions`), in v3 order; the first is primary. */
export function ActionBar(props: Props) {
  const { ticket, config, personId, actor, crew, error, pending } = props;
  const { t } = useTranslation();
  const gate = useLockoutGate();
  const [open, setOpen] = useState<ActionSpec | null>(null);
  // On a flagged ticket Start, Resume and Join confirm the lockout first, then run.
  const onRun = async (action: CommandAction, body: CommandBody) => {
    if (isGated(gate.view, action)) return gate.run(action, body);
    // Once the person's own confirmation stands, the command runs through the page itself; a success
    // there means the lockout refusal it was retried after no longer applies.
    const ran = await props.onRun(action, body);
    if (ran) gate.clearRefusal();
    return ran;
  };
  const specs = actionSpecs(ticket, crew, actor);
  if (specs.length === 0) return null;

  function choose(spec: ActionSpec) {
    if (spec.preset === 'report') props.onWriteReport();
    else if (spec.action === 'close' || FORM_ACTIONS.has(spec.action)) setOpen(spec);
    else void onRun(spec.action, {});
  }

  const tickHint = tickHintOf(gate, specs);

  return (
    <section aria-label={t('action.aria')} className="flex flex-col gap-2">
      <h2 className="v2-h2">{t('action.aria')}</h2>
      <div className="v2-action-bar">
        {specs.map((spec) => (
          <ActionButton
            key={`${spec.action}-${spec.preset ?? ''}`}
            spec={spec}
            disabled={pending}
            onClick={() => choose(spec)}
          />
        ))}
      </div>
      {tickHint ? <p className="v2-sub v2-center">{t('lockout.tickAll', tickHint)}</p> : null}
      {open?.preset === 'no_report' && <NoReportSheet {...props} onClose={() => setOpen(null)} />}
      {open?.preset === 'done' && <DoneSheet {...props} onClose={() => setOpen(null)} />}
      {open && open.action !== 'close' && (
        <ActionForm
          action={open.action}
          personId={personId}
          config={config}
          pending={pending}
          onRun={onRun}
          onDone={() => setOpen(null)}
        />
      )}
      {error && <Notice tone="error" title={error} />}
    </section>
  );
}
