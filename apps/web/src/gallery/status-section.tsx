import { useTranslation } from 'react-i18next';
import { Inline, Stack } from '../ui/layout.js';
import { STATUS, type StatusGroup, type StatusId } from '../ui/status/index.js';
import { StatusPill } from '../ui/status/status-pill.js';

export function StatusSection() {
  const { t } = useTranslation('gallery');
  return (
    <section data-testid="gallery-status" aria-labelledby="gallery-status-h">
      <Stack>
        <h2 id="gallery-status-h" className="text-title3 font-semibold">
          {t('section.status')}
        </h2>
        {(Object.keys(STATUS) as StatusGroup[]).map((group) => (
          <Stack key={group} gap={2}>
            <h3 className="text-footnote font-medium text-neutral-700">{group}</h3>
            <Inline gap={2}>
              {(Object.keys(STATUS[group]) as StatusId<typeof group>[]).map((id) => (
                <StatusPill key={id} group={group} id={id} />
              ))}
            </Inline>
          </Stack>
        ))}
      </Stack>
    </section>
  );
}
