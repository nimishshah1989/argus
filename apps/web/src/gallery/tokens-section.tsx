/* eslint-disable i18next/no-literal-string -- gallery specimens and switch values are not product copy */
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/card.js';
import { Grid, Inline, Stack } from '../ui/layout.js';

const COLOURS = [
  'accent',
  'accent-strong',
  'surface',
  ...[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => `neutral-${n}`),
  'danger',
  'info',
  'warning',
  'hold',
  'moved',
  'ok',
  'muted',
];
const TYPE = ['caption', 'footnote', 'body', 'title3', 'title2', 'title1'];
const TYPE_CLASS: Record<string, string> = {
  caption: 'text-caption',
  footnote: 'text-footnote',
  body: 'text-body',
  title3: 'text-title3',
  title2: 'text-title2',
  title1: 'text-title1',
};
const SPACE = [4, 8, 12, 16, 24, 32, 48];
const RADIUS = [8, 12, 16];

export function TokensSection() {
  const { t } = useTranslation('gallery');
  return (
    <section data-testid="gallery-tokens" aria-labelledby="gallery-tokens-h">
      <Stack>
        <h2 id="gallery-tokens-h" className="text-title3 font-semibold">
          {t('section.tokens')}
        </h2>
        <Card title={t('tokens.colours')}>
          <Grid columns={2} gap={2}>
            {COLOURS.map((name) => (
              <Inline key={name} gap={2} wrap={false}>
                <span
                  className="size-8 shrink-0 rounded-lg border border-neutral-300"
                  style={{ background: `var(--color-${name})` }}
                />
                <span className="text-caption">{name}</span>
              </Inline>
            ))}
          </Grid>
        </Card>
        <Card title={t('tokens.type')}>
          {TYPE.map((name) => (
            <p key={name} className={TYPE_CLASS[name]}>
              {name} · {t('tokens.typeSample')}
            </p>
          ))}
        </Card>
        <ShapeCards />
      </Stack>
    </section>
  );
}

function ShapeCards() {
  const { t } = useTranslation('gallery');
  return (
    <>
      <Card title={t('tokens.space')}>
        {SPACE.map((px) => (
          <Inline key={px} gap={2} wrap={false}>
            <span className="h-3 bg-accent-strong" style={{ width: px }} />
            <span className="text-caption">{px} px</span>
          </Inline>
        ))}
      </Card>
      <Card title={t('tokens.radius')}>
        <Inline>
          {RADIUS.map((px) => (
            <span
              key={px}
              className="flex size-16 items-center justify-center border border-neutral-300 text-caption"
              style={{ borderRadius: px }}
            >
              {px} px
            </span>
          ))}
        </Inline>
      </Card>
      <Card title={t('tokens.shadow')}>
        <Inline>
          <span className="rounded-xl bg-surface p-4 text-caption shadow-card">card</span>
          <span className="rounded-xl bg-surface p-4 text-caption shadow-sheet">sheet</span>
        </Inline>
      </Card>
      <Card title={t('tokens.motion')}>
        <p className="text-footnote">fast 150 ms · slow 250 ms · 0 ms when reduced</p>
      </Card>
      <Card title={t('tokens.target')}>
        <span className="flex min-h-target items-center rounded-lg border border-neutral-300 px-3 text-footnote">
          52 px
        </span>
      </Card>
    </>
  );
}
