import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionCrewMember, ActorContext } from '@uptimo/domain';
import type { CommandAction, CommandBody, Config, Ticket } from '../api.js';
import { Banner } from '../ui/banner.js';
import { Button } from '../ui/button.js';
import { SectionTitle } from '../ui/detail-kit.js';
import { Grid, Stack } from '../ui/layout.js';
import { actionSpecs, type ActionSpec } from './actionSpecs.js';
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

/** Only the actions the server will accept for this actor (domain `availableActions`); the first is primary. */
export function ActionBar(props: Props) {
  const { ticket, config, personId, actor, crew, error, pending, onRun } = props;
  const { t } = useTranslation();
  const [open, setOpen] = useState<ActionSpec | null>(null);
  const specs = actionSpecs(ticket, crew, actor);
  if (specs.length === 0) return null;

  function choose(spec: ActionSpec) {
    if (spec.preset === 'report') props.onWriteReport();
    else if (spec.action === 'close' || FORM_ACTIONS.has(spec.action)) setOpen(spec);
    else void onRun(spec.action, {});
  }

  const button = (spec: ActionSpec) => (
    <Button
      key={`${spec.action}-${spec.preset ?? ''}`}
      variant={variantOf(spec)}
      disabled={pending}
      onClick={() => choose(spec)}
    >
      {t(spec.label)}
    </Button>
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
