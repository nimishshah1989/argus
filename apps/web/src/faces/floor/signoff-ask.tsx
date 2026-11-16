import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Ticket } from '../../api.js';
import {
  canAskHandback,
  signoffRefusal,
  signoffState,
  type Refusal,
} from '../../components/signoff.js';
import { useCommand } from '../../data/index.js';
import { Button } from '../../ui/button.js';
import { Grid, Stack } from '../../ui/layout.js';
import { Text } from '../../ui/text.js';
import { DisputeSheet } from './dispute-sheet.js';
import { RefusalNote } from './refusal-note.js';
import { SignoffAnswered } from './signoff-answered.js';
import { clock, type FloorData } from './use-floor.js';

const CONFIRMED = 'confirmed';
const DISPUTED = 'disputed';

/** Production's answer on a closed ticket: "Is it fixed?", then what they said (slice 6, frames 2 to 7). */
export function SignoffAsk({ data, ticket }: { data: FloorData; ticket: Ticket }) {
  const { t } = useTranslation();
  const command = useCommand();
  const [sheet, setSheet] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const handback = ticket.handback;
  if (!handback) return null;
  const state = signoffState(handback);
  const answers = canAskHandback(data.me.role);
  if (state !== 'asking') {
    // A technician or the board never answers, so the confirmed and reopened lines ("You said…") would put
    // words in their mouth; the timed-out line says only what the plant did, so it still reads true.
    if (answers || state === 'timedOut') return <SignoffAnswered ticket={ticket} />;
    return null;
  }
  // The ask buttons are for the people who may answer; everyone else must never see them and earn a 403.
  if (!answers) return null;

  async function answer(response: typeof CONFIRMED | typeof DISPUTED, reason?: string) {
    setRefusal(null);
    const body = { personId: data.me.actingPersonId, response, ...(reason ? { reason } : {}) };
    const done = await command.run(ticket.id, 'handback', body);
    if (done) setSheet(false);
    else setRefusal(signoffRefusal(command.failure(), response));
    return done;
  }

  return (
    <Stack gap={3}>
      <Text as="h3" weight="bold">
        {t('signoff.ask')}
      </Text>
      {ticket.closedAt ? (
        <Text>{t('signoff.askBody', { time: clock(ticket.closedAt) })}</Text>
      ) : null}
      <RefusalNote refusal={sheet ? null : refusal} />
      <Grid columns={2} gap={2}>
        <Button disabled={command.pending} onClick={() => void answer(CONFIRMED)}>
          {t('signoff.yes')}
        </Button>
        <Button variant="secondary" onClick={() => setSheet(true)}>
          {t('signoff.no')}
        </Button>
      </Grid>
      <DisputeSheet
        open={sheet}
        onOpenChange={setSheet}
        ticket={ticket}
        refusal={refusal}
        pending={command.pending}
        send={(reason) => answer(DISPUTED, reason)}
      />
    </Stack>
  );
}
