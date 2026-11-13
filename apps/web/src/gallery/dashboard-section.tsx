/* eslint-disable i18next/no-literal-string -- prop values and state ids only; every visible string goes through t() */
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { OnlineContext } from '../data/index.js';
import { DashboardPage } from '../patterns/dashboard-page.js';
import { Stack } from '../ui/layout.js';
import {
  DASHBOARD_EXAMPLES,
  dashboardResources,
  SEGMENTS,
  type GalleryDashboard,
} from './more-data.js';
import { galleryQueries } from './patterns-section.js';

export function DashboardSection() {
  const { search, hash } = useLocation();
  const { t } = useTranslation('gallery');
  // A router hash change does not scroll by itself; the drill-down target must come on screen.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  return (
    <QueryClientProvider client={galleryQueries}>
      <section data-testid="gallery-dashboard" aria-labelledby="gallery-dashboard-h">
        <Stack>
          <h2 id="gallery-dashboard-h" className="text-title3 font-semibold">
            {t('section.dashboard')}
          </h2>
          {DASHBOARD_EXAMPLES.map((state) => (
            <div key={state} data-testid={`gallery-dashboard-${state}`}>
              <OnlineContext.Provider value={state === 'offline' ? false : null}>
                <DashboardPage<GalleryDashboard>
                  title={t('example', { name: t('dashboard.name'), state: t(`state.${state}`) })}
                  resource={dashboardResources[state]}
                  empty={t('dashboard.empty')}
                  kpis={(d) => [
                    {
                      label: t('dashboard.kpi.open'),
                      value: String(d.open),
                      to: { search, hash: '#gallery-queue-h' },
                    },
                    { label: t('dashboard.kpi.stopped'), value: String(d.stopped) },
                    { label: t('dashboard.kpi.repair'), value: d.repair },
                  ]}
                  charts={(d) => [
                    {
                      kind: 'bar',
                      title: t('dashboard.chart.bySegment'),
                      categoryLabel: t('dashboard.axis.segment'),
                      categories: SEGMENTS.map((s) => t(`segment.${s}`)),
                      series: [{ name: t('dashboard.series.breakdowns'), values: d.bySegment }],
                    },
                    {
                      kind: 'line',
                      title: t('dashboard.chart.downtime'),
                      categoryLabel: t('dashboard.axis.week'),
                      categories: d.weeks,
                      series: [
                        { name: t('segment.cnc'), values: d.downtime.cnc },
                        { name: t('segment.conventional'), values: d.downtime.conventional },
                      ],
                    },
                  ]}
                />
              </OnlineContext.Provider>
            </div>
          ))}
        </Stack>
      </section>
    </QueryClientProvider>
  );
}
