import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REASON_MAX_LENGTH } from '@uptimo/shared/ticket';
import type { Ticket } from '../../api.js';
import type { Refusal } from '../../components/signoff.js';
import { Button } from '../../ui/button.js';
import { Label, Textarea } from '../../ui/input.js';
import { Stack } from '../../ui/layout.js';
import { Sheet } from '../../ui/sheet.js';
import { Text } from '../../ui/text.js';
import { RefusalNote } from './refusal-note.js';
import { clock } from './use-floor.js';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket;
  refusal: Refusal | null;
  pending: boolean;
  send: (reason: string) => Promise<boolean>;
}

/** "Not fixed": the required reason, or the refusal when the machine already has a new open breakdown (frames 3 and 4). */
export function DisputeSheet({ open, onOpenChange, ticket, refusal, pending, send }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  // Closing the sheet drops a half-typed reason; reopening it starts clean.
  useEffect(() => {
    if (!open) setReason('');
  }, [open]);
  const refused = refusal?.kind === 'newBreakdown' ? refusal : null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('signoff.no')}>
      <Stack gap={3}>
        {refused ? (
          <>
            <Text weight="bold">
              {refused.ref
                ? t('signoff.refusedTitle', { ref: refused.ref })
                : t('signoff.refusedTitleNoRef')}
            </Text>
            {refused.reportedAt ? (
              <Text size="footnote" tone="secondary">
                {t('signoff.refusedReported', { time: clock(refused.reportedAt) })}
              </Text>
            ) : null}
            <Text size="footnote" tone="secondary">
              {t('signoff.refusedBody', { ref: ticket.ref })}
            </Text>
          </>
        ) : (
          <Text>{t('signoff.disputeNote', { ref: ticket.ref })}</Text>
        )}
        <Label htmlFor={`signoff-${ticket.id}`}>{t('signoff.reasonLabel')}</Label>
        <Textarea
          id={`signoff-${ticket.id}`}
          value={reason}
          maxLength={REASON_MAX_LENGTH}
          onChange={(e) => setReason(e.target.value)}
        />
        <Text size="footnote" tone="secondary">
          {t('signoff.reasonHint')}
        </Text>
        {refused ? null : <RefusalNote refusal={refusal} />}
        {refused ? (
          <Button onClick={() => onOpenChange(false)}>{t('signoff.back')}</Button>
        ) : (
          <>
            <Button disabled={!reason.trim() || pending} onClick={() => void send(reason.trim())}>
              {t('signoff.send')}
            </Button>
            {/* eslint-disable-next-line i18next/no-literal-string -- prop value, not copy */}
            <Button variant="quiet" onClick={() => onOpenChange(false)}>
              {t('signoff.cancel')}
            </Button>
          </>
        )}
      </Stack>
    </Sheet>
  );
}
