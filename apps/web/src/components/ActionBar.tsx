import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionCrewMember, ActorContext } from '@uptimo/domain';
import type { CommandAction, CommandBody, Config, Ticket } from '../api.js';
import { Banner } from '../ui/banner.js';
import { Button } from '../ui/button.js';
import { RefreshCw } from '../ui/icon.js';
import { SectionTitle } from '../ui/detail-kit.js';
import { Grid, Stack } from '../ui/layout.js';
import { actionSpecs, type ActionSpec } from './actionSpecs.js';
import { ActionForm } from './ActionForm.js';
import { DoneSheet, NoReportSheet } from './closeSheets.js';
import { useLockoutGate } from './LockoutGate.js';
import { isGated } from './lockout.js';

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

function variantOf(spec: ActionSpec) {
  if (spec.action === 'cancel') return 'quiet-danger';
  return spec.primary ? 'primary' : 'secondary';
}

/** Pause and Transfer sit side by side (design lock B2-3); every other action has its own row. */
function rowsOf(specs: ActionSpec[]): ActionSpec[][] {
  const rows: ActionSpec[][] = [];
  for (const spec of specs) {
    const last = rows[rows.length - 1];
    if (spec.action === 'transfer' && last?.[0]?.action === 'pause') last.push(spec);
    else rows.push([spec]);
  }
  return rows;
}

/** The busy line says which gated action is being sent, not always "starting". */
const CONFIRMING: Record<string, string> = {
  start: 'lockout.confirmingStart',
  resume: 'lockout.confirmingResume',
  join: 'lockout.confirmingJoin',
};

/** One action button; on a flagged ticket Start, Resume and Join wait for the ticks and say why. */
function ActionButton(props: { spec: ActionSpec; disabled: boolean; onClick: () => void }) {
  const { spec, disabled, onClick } = props;
  const { t } = useTranslation();
  const gate = useLockoutGate();
  const held = gate.holds(spec.action);
  const sending = gate.sending(spec.action);
  const confirming = CONFIRMING[spec.action] ?? 'lockout.confirming';
  return (
    <>
      <Button
        variant={variantOf(spec)}
        disabled={disabled || (gate.busy && !sending) || held}
        aria-busy={sending}
        onClick={() => !gate.busy && onClick()}
      >
        {sending ? (
          <span className="inline-flex items-center justify-center gap-2">
            <RefreshCw aria-hidden size={20} />
            {t(confirming)}
          </span>
        ) : (
          t(spec.label)
        )}
      </Button>
      {held && gate.view?.kind === 'ticking' && (
        <p className="text-center text-footnote text-neutral-600">
          {t('lockout.tickAll', { count: gate.view.steps.length })}
        </p>
      )}
    </>
  );
}

/** Only the actions the server will accept for this actor (domain `availableActions`); the first is primary. */
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

  const button = (spec: ActionSpec) => (
    <ActionButton
      key={`${spec.action}-${spec.preset ?? ''}`}
      spec={spec}
      disabled={pending}
      onClick={() => choose(spec)}
    />
  );

  return (
    <section aria-label={t('action.aria')}>
      <Stack gap={2}>
        <SectionTitle>{t('action.aria')}</SectionTitle>
        {rowsOf(specs).map((row) =>
          row.length === 1 ? (
            button(row[0]!)
          ) : (
            <Grid key={row[0]!.action} columns={2} gap={2}>
              {row.map(button)}
            </Grid>
          ),
        )}
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
        {error && <Banner tone="error" title={error} />}
      </Stack>
    </section>
  );
}
