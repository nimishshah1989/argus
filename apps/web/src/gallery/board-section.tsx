/* eslint-disable i18next/no-literal-string -- prop values and state ids only; every visible string goes through t() */
import { QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { OnlineContext } from '../data/index.js';
import { BoardPage } from '../patterns/board-page.js';
import { Card } from '../ui/card.js';
import { Stack } from '../ui/layout.js';
import { boardResources, type BoardRow } from './more-data.js';
import { EXAMPLES } from './patterns-data.js';
import { galleryQueries } from './patterns-section.js';

export function BoardSection() {
  const { t } = useTranslation('gallery');
  const { t: tc } = useTranslation();
  return (
    <QueryClientProvider client={galleryQueries}>
      <section data-testid="gallery-board" aria-labelledby="gallery-board-h">
        <Stack>
          <h2 id="gallery-board-h" className="text-title3 font-semibold">
            {t('section.board')}
          </h2>
          {EXAMPLES.map((state) => (
            <div key={state} data-testid={`gallery-board-${state}`}>
              <OnlineContext.Provider value={state === 'offline' ? false : null}>
                <BoardPage<BoardRow>
                  title={t('example', { name: t('board.name'), state: t(`state.${state}`) })}
                  resource={boardResources[state]}
                  groups={[
                    { id: 'stopped', title: tc('status.ticket.stopped') },
                    { id: 'in_progress', title: tc('status.ticket.inProgress') },
                    { id: 'waiting', title: tc('status.ticket.waiting') },
                  ]}
                  groupOf={(r) => r.status}
                  filters={[
                    { id: 'all', label: t('board.filter.all'), query: {} },
                    { id: 'cnc', label: t('segment.cnc'), query: { segment: 'cnc' } },
                    {
                      id: 'conventional',
                      label: t('segment.conventional'),
                      query: { segment: 'conventional' },
                    },
                  ]}
                  tile={(r) => (
                    <Card title={r.ref}>
                      <p className="text-body">
                        {r.machine} · {t(r.problemKey)}
                      </p>
                    </Card>
                  )}
                  rowKey={(r) => r.id}
                  empty={t('board.empty')}
                />
              </OnlineContext.Provider>
            </div>
          ))}
        </Stack>
      </section>
    </QueryClientProvider>
  );
}
