import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Ticket } from '../../api.js';
import { actorFrom, offers } from '../../components/actionSpecs.js';
import { useCommand } from '../../data/index.js';
import { Button } from '../../ui/button.js';
import { Label, Textarea } from '../../ui/input.js';
import { Stack } from '../../ui/layout.js';
import { Sheet } from '../../ui/sheet.js';
import { Text } from '../../ui/text.js';
import type { FloorData } from './use-floor.js';

const CANCEL = 'cancel';

/** Cancel on the person's own ticket while nobody has started it (the domain decides, as before). */
export function CancelComplaint({ data, ticket }: { data: FloorData; ticket: Ticket }) {
  const { t } = useTranslation();
  const command = useCommand();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const actor = actorFrom(data.me);
  if (!actor || !offers(ticket, actor, CANCEL)) return null;
  async function cancel(): Promise<void> {
    const body = { personId: data.me.actingPersonId, reason: reason.trim() };
    if (await command.run(ticket.id, CANCEL, body)) setOpen(false);
  }
  return (
    <>
      {/* eslint-disable-next-line i18next/no-literal-string -- prop value, not copy */}
      <Button variant="quiet-danger" onClick={() => setOpen(true)}>
        {t('action.cancel')}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={t('action.cancel.title')}>
        <Stack gap={3}>
          <Label htmlFor={`cancel-${ticket.id}`}>{t('action.whyCancel')}</Label>
          <Textarea
            id={`cancel-${ticket.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {command.error ? <Text tone="danger">{command.error}</Text> : null}
          <Button disabled={!reason.trim() || command.pending} onClick={() => void cancel()}>
            {t('action.cancel.submit')}
          </Button>
        </Stack>
      </Sheet>
    </>
  );
}
