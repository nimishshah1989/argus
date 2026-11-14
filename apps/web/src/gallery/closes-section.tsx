/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible string goes through t() */
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button.js';
import { FinishTime, Field, ScreenFooter } from '../ui/close-kit.js';
import { Input } from '../ui/input.js';
import { Stack } from '../ui/layout.js';

const noop = () => undefined;

/** The close screens' pieces (design lock slice 2, S3): the finish-time card, a read-only field, the pinned footer. */
export function ClosesSection() {
  const { t } = useTranslation();
  return (
    <section data-testid="gallery-closes" aria-labelledby="gallery-closes-h">
      <Stack>
        <h2 id="gallery-closes-h" className="text-title3 font-semibold">
          {t('closes.step1.title')}
        </h2>
        <FinishTime
          title={t('closes.finish.title')}
          label={t('closes.finish.label')}
          time="11:14 AM"
          status={t('closes.finish.now')}
          hint={t('closes.finish.hint')}
          earlier={t('closes.finish.earlier')}
          now={t('closes.finish.now')}
          later={t('closes.finish.later')}
          canEarlier
          canNow={false}
          isNow
          canLater={false}
          onEarlier={noop}
          onNow={noop}
          onLater={noop}
        />
        <Field id="gallery-closes-machine" label={t('closes.form.machine')}>
          <Input id="gallery-closes-machine" readOnly value="TC-04" />
        </Field>
        <ScreenFooter hint={t('closes.form.hintClose')}>
          <Button disabled>{t('report.closeWithReport')}</Button>
        </ScreenFooter>
      </Stack>
    </section>
  );
}
