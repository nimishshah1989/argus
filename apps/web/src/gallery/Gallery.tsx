/* eslint-disable i18next/no-literal-string -- only prop names and switch values remain; every visible string goes through t() or the kit index */
import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { SourceContext } from '../screens/v2/data.js';
import { setLanguage } from '../i18n/index.js';
import { Panel } from '../ui/v2/panel.js';
import { Segmented } from '../ui/v2/segmented.js';
import { KIT, KIT_GROUPS } from './kit-index.js';
import { registerGalleryStrings } from './strings.js';
import { V2_VIEWS } from './v2-views.js';

registerGalleryStrings();

// The chart door's one chart per kind (ticket 84), for the e2e check of the numbers table and reduced motion.
const ChartDoor = lazy(() => import('./chart-door-view.js'));
const ChartDoorView = () => (
  <Suspense fallback={null}>
    <ChartDoor />
  </Suspense>
);

/** The gallery's whole-page views, picked by `?view=`; anything else is the kit index. */
const VIEWS: Record<string, () => React.JSX.Element> = { charts: ChartDoorView, ...V2_VIEWS };

/** Own keys only, so `?view=constructor` is not a view. */
const viewFor = (view: string | null) =>
  view !== null && Object.hasOwn(VIEWS, view) ? VIEWS[view] : undefined;

/** The gallery sets language and theme on <html> and puts them back when you leave. */
function useDocumentAttributes(lang: 'en' | 'gu', theme: 'dark' | 'light') {
  useEffect(() => {
    void setLanguage(lang);
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
  }, [theme]);
  useEffect(
    () => () => {
      document.documentElement.lang = 'en';
      delete document.documentElement.dataset.theme;
      void setLanguage('en');
    },
    [],
  );
}

/** One card per group of the kit, each part with its file and what it is for (KIT.md has the full entry). */
function KitGroups() {
  return KIT_GROUPS.map((g) => (
    <Panel key={g.key} title={g.title}>
      <ul className="v2-stack v2-gap-8">
        {KIT.filter((p) => p.group === g.key).map((p) => (
          <li key={p.file}>
            <strong>{p.name}</strong> <code>{p.file}</code>
            <p className="v2-sub">{p.use}</p>
          </li>
        ))}
      </ul>
    </Panel>
  ));
}

function KitIndex({ lang, theme }: { lang: 'en' | 'gu'; theme: 'dark' | 'light' }) {
  const { t } = useTranslation('gallery');
  const [, setParams] = useSearchParams();
  const set = (param: string) => (value: string) =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set(param, value);
      return next;
    });
  return (
    <div data-testid="gallery-root" className="v2-app">
      <main className="v2-content">
        <h1 className="v2-h2">{t('title')}</h1>
        <p className="v2-sub">{t('intro')}</p>
        <div className="v2-row v2-gap-12">
          <Segmented
            label={t('language')}
            value={lang}
            onChange={set('lang')}
            options={[
              { key: 'en', label: t('language.en') },
              { key: 'gu', label: t('language.gu') },
            ]}
          />
          <Segmented
            label={t('theme')}
            value={theme}
            onChange={set('theme')}
            options={[
              { key: 'light', label: t('theme.light') },
              { key: 'dark', label: t('theme.dark') },
            ]}
          />
        </div>
        {lang === 'gu' ? <p className="v2-sub">{t('guBanner')}</p> : null}
        <KitGroups />
        <Panel title={t('screens')}>
          <ul className="v2-stack v2-gap-8">
            {Object.keys(V2_VIEWS)
              .sort()
              .map((view) => (
                <li key={view}>
                  <a href={`/gallery?view=${view}`}>{view}</a>
                </li>
              ))}
          </ul>
        </Panel>
      </main>
    </div>
  );
}

function GalleryPage() {
  const [params] = useSearchParams();
  const lang = params.get('lang') === 'gu' ? 'gu' : 'en';
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
  useDocumentAttributes(lang, theme);
  const View = viewFor(params.get('view'));
  return View ? <View /> : <KitIndex lang={lang} theme={theme} />;
}

/** The gallery runs every screen on its frozen answer key (a screen's `frozen` provider), never on the server. */
export default function Gallery() {
  return (
    <SourceContext.Provider value="frozen">
      <GalleryPage />
    </SourceContext.Provider>
  );
}
