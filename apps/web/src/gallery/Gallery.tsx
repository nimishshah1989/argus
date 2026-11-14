/* eslint-disable i18next/no-literal-string -- only prop names and switch values (lang/accent ids) remain; every visible string goes through t() */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { setLanguage } from '../i18n/index.js';
import { Button } from '../ui/button.js';
import { Inline, Page, Stack } from '../ui/layout.js';
import { BoardSection } from './board-section.js';
import { CrudSection } from './crud-section.js';
import { DashboardSection } from './dashboard-section.js';
import { DesktopView } from './desktop-section.js';
import { DeskKitSection } from './desk-kit-section.js';
import { DetailKitSection } from './detail-kit-section.js';
import { FloorSection } from './floor-section.js';
import { FormSection } from './form-section.js';
import { KitSection } from './kit-section.js';
import { MeaningSection } from './meaning-section.js';
import { PatternsSection } from './patterns-section.js';
import { StatusSection } from './status-section.js';
import { ShellSection } from './shell-section.js';
import { registerGalleryStrings } from './strings.js';
import { TokensSection } from './tokens-section.js';
import { WizardSection } from './wizard-section.js';

registerGalleryStrings();

function Switcher({
  label,
  param,
  options,
  current,
}: {
  label: string;
  param: string;
  options: { value: string; label: string }[];
  current: string;
}) {
  const [, setParams] = useSearchParams();
  return (
    <div role="group" aria-labelledby={`gallery-${param}-label`}>
      <Stack gap={2}>
        <span id={`gallery-${param}-label`} className="text-footnote font-medium">
          {label}
        </span>
        <Inline gap={2}>
          {options.map((o) => (
            <Button
              key={o.value}
              variant={o.value === current ? 'primary' : 'secondary'}
              aria-pressed={o.value === current}
              onClick={() =>
                setParams((p) => {
                  const next = new URLSearchParams(p);
                  next.set(param, o.value);
                  return next;
                })
              }
            >
              {o.label}
            </Button>
          ))}
        </Inline>
      </Stack>
    </div>
  );
}

function GuNote() {
  const { t } = useTranslation('gallery');
  return (
    <>
      <p className="text-footnote">{t('guBanner')}</p>
      <p data-testid="gallery-gu-specimen" className="text-body">
        {t('guSpecimen')}
      </p>
    </>
  );
}

/** The gallery sets language, accent and theme on <html> and puts them back when you leave. */
function useDocumentAttributes(
  lang: 'en' | 'gu',
  accent: 'blue' | 'teal',
  theme: 'dark' | 'light',
) {
  useEffect(() => {
    void setLanguage(lang);
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    if (accent === 'blue') document.documentElement.dataset.accent = 'blue';
    else delete document.documentElement.dataset.accent;
  }, [accent]);
  useEffect(() => {
    if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
  }, [theme]);
  useEffect(
    () => () => {
      document.documentElement.lang = 'en';
      delete document.documentElement.dataset.accent;
      delete document.documentElement.dataset.theme;
      void setLanguage('en');
    },
    [],
  );
}

export default function Gallery() {
  const { t } = useTranslation('gallery');
  const [params] = useSearchParams();
  const lang = params.get('lang') === 'gu' ? 'gu' : 'en';
  const accent = params.get('accent') === 'blue' ? 'blue' : 'teal';
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light';

  useDocumentAttributes(lang, accent, theme);
  if (params.get('view') === 'desktop') return <DesktopView />;

  return (
    <div data-testid="gallery-root">
      <Page title={t('title')}>
        <Switcher
          label={t('language')}
          param="lang"
          current={lang}
          options={[
            { value: 'en', label: t('language.en') },
            { value: 'gu', label: t('language.gu') },
          ]}
        />
        <Switcher
          label={t('accent')}
          param="accent"
          current={accent}
          options={[
            { value: 'teal', label: t('accent.teal') },
            { value: 'blue', label: t('accent.blue') },
          ]}
        />
        <Switcher
          label={t('theme')}
          param="theme"
          current={theme}
          options={[
            { value: 'light', label: t('theme.light') },
            { value: 'dark', label: t('theme.dark') },
          ]}
        />
        {lang === 'gu' ? <GuNote /> : null}
        <TokensSection />
        <KitSection />
        <StatusSection />
        <MeaningSection />
        <PatternsSection />
        <FormSection />
        <CrudSection />
        <WizardSection />
        <FloorSection />
        <BoardSection />
        <DashboardSection />
        <ShellSection />
        <DeskKitSection />
        <DetailKitSection />
      </Page>
    </div>
  );
}
