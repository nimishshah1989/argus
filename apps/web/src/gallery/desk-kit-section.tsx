/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible string goes through t() */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button.js';
import { CountsStrip } from '../ui/counts-strip.js';
import { CircleCheck, Hourglass, LifeBuoy, OctagonX } from '../ui/icon.js';
import { Stack } from '../ui/layout.js';
import { SegmentedBar } from '../ui/segmented-bar.js';
import { StatusPill } from '../ui/status/status-pill.js';
import { TicketCard } from '../ui/ticket-card.js';

/** The desk list pieces (design lock B1): counts that filter, the list switch, and a ticket card. */
export function DeskKitSection() {
  const { t } = useTranslation('gallery');
  const [count, setCount] = useState('');
  const [segment, setSegment] = useState('breakdowns');
  return (
    <section data-testid="gallery-desk" aria-labelledby="gallery-desk-h">
      <Stack>
        <h2 id="gallery-desk-h" className="text-title3 font-semibold">
          {t('section.desk')}
        </h2>
        <CountsStrip
          label={t('desk.counts')}
          selected={count}
          onSelect={setCount}
          items={[
            { id: 'down', label: t('desk.down'), value: 2, tone: 'danger', icon: OctagonX },
            { id: 'waiting', label: t('desk.waiting'), value: 1, tone: 'hold', icon: Hourglass },
            { id: 'support', label: t('desk.support'), value: 1, tone: 'warning', icon: LifeBuoy },
            { id: 'running', label: t('desk.running'), value: 161, tone: 'ok', icon: CircleCheck },
          ]}
        />
        <SegmentedBar
          label={t('desk.lists')}
          selected={segment}
          onSelect={setSegment}
          items={[
            { id: 'breakdowns', label: t('desk.breakdowns') },
            { id: 'tasks', label: t('desk.tasks') },
            { id: 'work', label: t('desk.work') },
          ]}
        />
        <TicketCard
          to="#ticket"
          title="VC-17"
          refLabel="BD-0149"
          status={<StatusPill group="ticket" id="stopped" />}
          kind={{ text: t('desk.kind'), tone: 'danger', icon: OctagonX }}
          problem={t('desk.problem')}
          meta={t('desk.meta')}
          time={{ text: t('desk.time'), tone: 'hold' }}
        >
          <Button variant="tonal">{t('desk.start')}</Button>
          <Button variant="quiet-danger">{t('sample.quietDanger')}</Button>
        </TicketCard>
      </Stack>
    </section>
  );
}
