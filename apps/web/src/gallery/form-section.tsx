/* eslint-disable i18next/no-literal-string -- prop values and state ids only; every visible string goes through t() */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OnlineContext } from '../data/index.js';
import { FormSheet } from '../patterns/form-sheet.js';
import { Button } from '../ui/button.js';
import { Inline, Stack } from '../ui/layout.js';

const STATES = ['loading', 'empty', 'error', 'offline'] as const;
type FormState = (typeof STATES)[number];

export function FormSection() {
  const { t } = useTranslation('gallery');
  const [open, setOpen] = useState<FormState | null>(null);
  return (
    <section data-testid="gallery-forms" aria-labelledby="gallery-forms-h">
      <Stack>
        <h2 id="gallery-forms-h" className="text-title3 font-semibold">
          {t('section.forms')}
        </h2>
        <Inline gap={2}>
          {STATES.map((state) => (
            <Button
              key={state}
              variant="secondary"
              data-testid={`gallery-form-open-${state}`}
              onClick={() => setOpen(state)}
            >
              {t('form.open', { state: t(`state.${state}`) })}
            </Button>
          ))}
        </Inline>
        {STATES.map((state) => (
          <OnlineContext.Provider key={state} value={state === 'offline' ? false : null}>
            <FormSheet
              open={open === state}
              onOpenChange={(next) => setOpen(next ? state : null)}
              title={t('form.name')}
              submitLabel={t('form.submit')}
              fields={[{ name: 'note', label: t('form.note'), required: true }]}
              offlineAllowed
              pending={state === 'loading'}
              error={state === 'error' ? t('form.error') : null}
              onSubmit={async () => true}
            />
          </OnlineContext.Provider>
        ))}
      </Stack>
    </section>
  );
}
