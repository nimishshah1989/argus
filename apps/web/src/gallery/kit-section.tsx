/* eslint-disable i18next/no-literal-string -- gallery specimens and switch values are not product copy */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button.js';
import { Card } from '../ui/card.js';
import { Input, Label } from '../ui/input.js';
import { Grid, Inline, Page, Stack } from '../ui/layout.js';
import { Sheet } from '../ui/sheet.js';

function Box({ label }: { label: string }) {
  return <span className="rounded-lg bg-neutral-200 p-2 text-center text-caption">{label}</span>;
}

export function KitSection() {
  const { t } = useTranslation('gallery');
  const [open, setOpen] = useState(false);
  return (
    <>
      <section data-testid="gallery-components" aria-labelledby="gallery-components-h">
        <Stack>
          <h2 id="gallery-components-h" className="text-title3 font-semibold">
            {t('section.components')}
          </h2>
          <Button data-testid="gallery-primary-sample">{t('sample.primary')}</Button>
          <Button variant="secondary">{t('sample.secondary')}</Button>
          <Stack gap={1}>
            <Label htmlFor="gallery-machine">{t('sample.label')}</Label>
            <Input id="gallery-machine" placeholder={t('sample.placeholder')} />
          </Stack>
          <Card title={t('sample.cardTitle')}>
            <p className="text-body">{t('sample.cardBody')}</p>
          </Card>
          <Button
            data-testid="gallery-sheet-open"
            variant="secondary"
            onClick={() => setOpen(true)}
          >
            {t('sample.openSheet')}
          </Button>
          <Sheet open={open} onOpenChange={setOpen} title={t('sample.sheetTitle')}>
            <p className="text-body">{t('sample.sheetBody')}</p>
          </Sheet>
        </Stack>
      </section>
      <LayoutSection />
    </>
  );
}

function LayoutSection() {
  const { t } = useTranslation('gallery');
  const box = t('sample.box');
  return (
    <section data-testid="gallery-layout" aria-labelledby="gallery-layout-h">
      <Stack>
        <h2 id="gallery-layout-h" className="text-title3 font-semibold">
          {t('section.layout')}
        </h2>
        <Card title="Page">
          <Page title={box} />
        </Card>
        <Card title="Stack">
          <Stack gap={2}>
            <Box label={box} />
            <Box label={box} />
          </Stack>
        </Card>
        <Card title="Inline">
          <Inline gap={2}>
            <Box label={box} />
            <Box label={box} />
            <Box label={box} />
          </Inline>
        </Card>
        <Card title="Grid">
          <Grid columns={3} gap={2}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Box key={n} label={box} />
            ))}
          </Grid>
        </Card>
      </Stack>
    </section>
  );
}
