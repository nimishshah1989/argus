/* eslint-disable i18next/no-literal-string -- prop values and state ids only; every visible string goes through t() */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { OnlineContext } from '../data/index.js';
import { DetailPage } from '../patterns/detail-page.js';
import { QueuePage } from '../patterns/queue-page.js';
import { Button } from '../ui/button.js';
import { Card } from '../ui/card.js';
import { Stack } from '../ui/layout.js';
import {
  detailResources,
  EXAMPLES,
  queueResources,
  type Example,
  type GalleryDetail,
  type GalleryRow,
} from './patterns-data.js';

// Own client: no retry, never stale, so the error state shows at once and nothing refetches.
const galleryQueries = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

function Example({ state, children }: { state: Example; children: React.ReactNode }) {
  return (
    <OnlineContext.Provider value={state === 'offline' ? false : null}>
      {children}
    </OnlineContext.Provider>
  );
}

function QueueExamples() {
  const { t } = useTranslation('gallery');
  const title = (name: string, state: Example) =>
    t('example', { name: t(name), state: t(`state.${state}`) });
  return (
    <section data-testid="gallery-queue" aria-labelledby="gallery-queue-h">
      <Stack>
        <h2 id="gallery-queue-h" className="text-title3 font-semibold">
          {t('section.queue')}
        </h2>
        {EXAMPLES.map((state) => (
          <div key={state} data-testid={`gallery-queue-${state}`}>
            <Example state={state}>
              <QueuePage<GalleryRow>
                title={title('queue.name', state)}
                resource={queueResources[state]}
                row={(row) => (
                  <Card title={row.ref}>
                    <p className="text-body">{t(row.problemKey)}</p>
                  </Card>
                )}
                rowKey={(row) => row.id}
                empty={t('queue.empty')}
              />
            </Example>
          </div>
        ))}
      </Stack>
    </section>
  );
}

function DetailExamples() {
  const { t } = useTranslation('gallery');
  const title = (name: string, state: Example) =>
    t('example', { name: t(name), state: t(`state.${state}`) });
  return (
    <section data-testid="gallery-detail" aria-labelledby="gallery-detail-h">
      <Stack>
        <h2 id="gallery-detail-h" className="text-title3 font-semibold">
          {t('section.detail')}
        </h2>
        {EXAMPLES.map((state) => (
          <div key={state} data-testid={`gallery-detail-${state}`}>
            <Example state={state}>
              <DetailPage<GalleryDetail>
                title={title('detail.name', state)}
                resource={detailResources[state]}
                id="gallery-1"
                facts={(d) => [
                  { label: t('detail.fact.machine'), value: d.machine },
                  { label: t('detail.fact.reported'), value: d.reported },
                  { label: t('detail.fact.problem'), value: t(d.problemKey) },
                ]}
                sections={(d) => [
                  {
                    title: t('detail.history'),
                    body: (
                      <ul>
                        {d.historyKeys.map((key) => (
                          <li key={key}>{t(key)}</li>
                        ))}
                      </ul>
                    ),
                  },
                ]}
                actions={() => <Button>{t('detail.action')}</Button>}
                empty={t('detail.empty')}
              />
            </Example>
          </div>
        ))}
      </Stack>
    </section>
  );
}

export function PatternsSection() {
  return (
    <QueryClientProvider client={galleryQueries}>
      <QueueExamples />
      <DetailExamples />
    </QueryClientProvider>
  );
}
