/* eslint-disable i18next/no-literal-string -- prop values and routes only; every visible string goes through t() */
import { QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Cog, FileCheck, Users } from '../ui/icon.js';
import { SideNav } from '../ui/side-nav.js';
import { CrudSection } from './crud-section.js';
import { DetailExample, galleryQueries, QueueExample } from './patterns-section.js';

/** `/gallery?view=desktop`: the page patterns at full width beside the left menu, as a 1440 px screen shows them. */
export function DesktopView() {
  const { t } = useTranslation('gallery');
  const here = '/gallery?view=desktop';
  const link = (page: string) => `${here}&page=${page}`;
  return (
    <div data-testid="gallery-root" className="flex min-h-dvh bg-neutral-100">
      <div className="sticky top-0 h-dvh">
        <SideNav
          label={t('desktop.nav')}
          current={here}
          groups={[
            {
              title: t('desktop.nav.settings'),
              items: [
                { to: here, label: t('desktop.nav.machines'), icon: Cog },
                { to: link('people'), label: t('desktop.nav.people'), icon: Users },
              ],
            },
            {
              title: t('desktop.nav.admin'),
              items: [
                { to: link('audit'), label: t('desktop.nav.audit'), icon: FileCheck, badge: 3 },
              ],
            },
          ]}
        />
      </div>
      <main className="flex min-w-0 flex-1 flex-col gap-6 p-6">
        <QueryClientProvider client={galleryQueries}>
          <div data-testid="gallery-desktop-queue">
            <QueueExample state="ready" />
          </div>
          <div data-testid="gallery-desktop-detail">
            <DetailExample state="ready" />
          </div>
          <CrudSection />
        </QueryClientProvider>
      </main>
    </div>
  );
}
