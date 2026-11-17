import { useTranslation } from 'react-i18next';
import { FIGURES } from '@uptimo/domain';
import { Stack } from '../../ui/layout.js';
import { ANALYTICS_GROUPS, FIGURE_LABELS, SCREEN_LABELS } from './groups.js';

/** The Guide (ticket 37b): every screen and the figures it will show, with the labels the face uses. */
export function GuidePage() {
  const { t } = useTranslation();
  return (
    <Stack gap={6}>
      <p className="max-w-3xl text-body text-neutral-600">{t('analytics.guide.intro')}</p>
      {ANALYTICS_GROUPS.filter((group) => group.screens.length > 0).map((group) => (
        <section key={group.id} className="flex flex-col gap-3">
          <h2 className="text-title2 font-semibold">{t(group.labelKey)}</h2>
          {group.screens.map((screen) => {
            const figures = FIGURES.filter((figure) => figure.screen === screen);
            if (figures.length === 0) return null;
            return (
              <div key={screen} className="rounded-2xl bg-surface p-4 shadow-card">
                <h3 className="text-title3 font-semibold">
                  {t(SCREEN_LABELS[screen] ?? 'analytics.screen.unknown')}
                </h3>
                <ul className="mt-2 list-disc pl-5 text-body text-neutral-900">
                  {figures.map((figure) => (
                    <li key={figure.key}>
                      {t(FIGURE_LABELS[figure.key] ?? 'analytics.figure.unknown')}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      ))}
    </Stack>
  );
}
