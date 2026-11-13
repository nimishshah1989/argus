import { QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CrudPage } from '../patterns/crud-page.js';
import { Stack } from '../ui/layout.js';
import { machinesSpec } from './crud-spec.js';
import { galleryQueries } from './patterns-section.js';

export function CrudSection() {
  const { t } = useTranslation('gallery');
  return (
    <QueryClientProvider client={galleryQueries}>
      <section data-testid="gallery-crud" aria-labelledby="gallery-crud-h">
        <Stack>
          <h2 id="gallery-crud-h" className="text-title3 font-semibold">
            {t('section.crud')}
          </h2>
          <CrudPage spec={machinesSpec} />
        </Stack>
      </section>
    </QueryClientProvider>
  );
}
