/* eslint-disable i18next/no-literal-string -- segment codes, status ids and test ids only; every visible string goes through t() */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterChip } from '../ui/filter-chip.js';
import { Inline, Stack } from '../ui/layout.js';
import { MachineIcon } from '../ui/machine-icon.js';
import { StatusPill } from '../ui/status/status-pill.js';

const SEGMENTS = ['CNC', 'Conventional', 'Process', 'Utility', 'DG', 'Robot', 'Paint'];
const LIVE = ['running', 'stopped', 'in_progress', 'support', 'waiting', 'transferred'] as const;

/** Slice 4 X1: segment = icon shape, live status = colour, filters = chips with icon, word and count. */
export function MeaningSection() {
  const { t } = useTranslation('gallery');
  const [pressed, setPressed] = useState<string>('stopped');
  const toggle = (id: string) => setPressed(pressed === id ? '' : id);
  return (
    <section data-testid="gallery-meaning" aria-labelledby="gallery-meaning-h">
      <Stack>
        <h2 id="gallery-meaning-h" className="text-title3 font-semibold">
          {t('section.meaning')}
        </h2>
        <Inline gap={3}>
          {SEGMENTS.map((code) => (
            <Stack key={code} gap={1}>
              <MachineIcon segment={code} status="running" />
              <span className="text-caption font-semibold">{code}</span>
            </Stack>
          ))}
        </Inline>
        <Stack gap={2}>
          {LIVE.map((id) => (
            <Inline key={id} gap={3} wrap={false}>
              <MachineIcon segment="CNC" status={id} />
              <StatusPill group="ticket" id={id} />
            </Inline>
          ))}
        </Stack>
        <div role="group" aria-label={t('meaning.filters')} className="flex flex-wrap gap-2">
          <FilterChip
            filter={{ all: t('meaning.all') }}
            count={192}
            pressed={pressed === 'all'}
            onClick={() => toggle('all')}
          />
          <FilterChip
            filter={{ status: { group: 'ticket', id: 'stopped' } }}
            count={2}
            pressed={pressed === 'stopped'}
            onClick={() => toggle('stopped')}
          />
          <FilterChip
            filter={{ status: { group: 'task', id: 'overdue' } }}
            count={1}
            pressed={pressed === 'overdue'}
            onClick={() => toggle('overdue')}
          />
          <FilterChip
            filter={{ segment: { code: 'CNC', name: t('meaning.cnc') } }}
            count={125}
            pressed={pressed === 'cnc'}
            onClick={() => toggle('cnc')}
          />
        </div>
      </Stack>
    </section>
  );
}
