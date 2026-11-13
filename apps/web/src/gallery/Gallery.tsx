/* eslint-disable i18next/no-literal-string -- gallery specimens and switch values are not product copy */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { setLanguage } from '../i18n/index.js';
import { Button } from '../ui/button.js';
import { Inline, Page, Stack } from '../ui/layout.js';
import { KitSection } from './kit-section.js';
import { StatusSection } from './status-section.js';
import { registerGalleryStrings } from './strings.js';
import { TokensSection } from './tokens-section.js';

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
    <Stack gap={2}>
      <span className="text-footnote font-medium">{label}</span>
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
  );
}

export default function Gallery() {
  const { t } = useTranslation('gallery');
  const [params] = useSearchParams();
  const lang = params.get('lang') === 'gu' ? 'gu' : 'en';
  const accent = params.get('accent') === 'teal' ? 'teal' : 'blue';

  useEffect(() => {
    void setLanguage(lang);
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    if (accent === 'teal') document.documentElement.dataset.accent = 'teal';
    else delete document.documentElement.dataset.accent;
  }, [accent]);
  useEffect(
    () => () => {
      document.documentElement.lang = 'en';
      delete document.documentElement.dataset.accent;
      void setLanguage('en');
    },
    [],
  );

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
            { value: 'blue', label: t('accent.blue') },
            { value: 'teal', label: t('accent.teal') },
          ]}
        />
        {lang === 'gu' ? (
          <>
            <p className="text-footnote">{t('guBanner')}</p>
            <p data-testid="gallery-gu-specimen" className="text-body">
              {t('guSpecimen')}
            </p>
          </>
        ) : null}
        <TokensSection />
        <KitSection />
        <StatusSection />
      </Page>
    </div>
  );
}
