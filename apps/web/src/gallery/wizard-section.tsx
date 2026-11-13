/* eslint-disable i18next/no-literal-string -- prop values and state ids only; every visible string goes through t() */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OnlineContext } from '../data/index.js';
import { WizardPage, type WizardStep } from '../patterns/wizard-page.js';
import { Button } from '../ui/button.js';
import { Inline, Stack } from '../ui/layout.js';
import { WIZARD_MACHINES, WIZARD_PROBLEMS } from './more-data.js';

function Choices({
  items,
  value,
  label,
  onPick,
  Layout,
}: {
  items: readonly string[];
  value: string | null;
  label: (item: string) => string;
  onPick: (item: string) => void;
  Layout: typeof Inline | typeof Stack;
}) {
  return (
    <Layout gap={2}>
      {items.map((item) => (
        <Button
          key={item}
          variant="secondary"
          aria-pressed={item === value}
          onClick={() => onPick(item)}
        >
          {label(item)}
        </Button>
      ))}
    </Layout>
  );
}

function ReadyWizard({ title }: { title: string }) {
  const { t } = useTranslation('gallery');
  const [machine, setMachine] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const steps: WizardStep[] = [
    {
      title: t('wizard.machine'),
      body: (
        <Choices
          items={WIZARD_MACHINES}
          value={machine}
          label={(m) => m}
          onPick={setMachine}
          Layout={Inline}
        />
      ),
      action: t('wizard.next'),
      ready: machine !== null,
    },
    {
      title: t('wizard.problem'),
      body: (
        <Choices
          items={WIZARD_PROBLEMS}
          value={problem}
          label={(key) => t(key)}
          onPick={setProblem}
          Layout={Stack}
        />
      ),
      action: t('wizard.next'),
      ready: problem !== null,
    },
    {
      title: t('wizard.check'),
      body: (
        <p className="text-body">
          {machine} · {t(problem ?? '')}
        </p>
      ),
      action: t('wizard.send'),
      ready: true,
    },
  ];
  return (
    <WizardPage
      title={title}
      steps={steps}
      offlineAllowed={false}
      onFinish={async () => undefined}
      result={<p className="text-body">{t('wizard.sent')}</p>}
    />
  );
}

export function WizardSection() {
  const { t } = useTranslation('gallery');
  const title = (state: string) =>
    t('example', { name: t('wizard.name'), state: t(`state.${state}`) });
  const checkStep: WizardStep = {
    title: t('wizard.check'),
    body: (
      <p className="text-body">
        {WIZARD_MACHINES[0]} · {t('queue.problem.1')}
      </p>
    ),
    action: t('wizard.send'),
    ready: true,
  };
  const single = (onFinish: () => Promise<void>, state: string) => (
    <WizardPage
      title={title(state)}
      steps={[checkStep]}
      offlineAllowed={false}
      onFinish={onFinish}
      result={<p className="text-body">{t('wizard.sent')}</p>}
    />
  );
  return (
    <section data-testid="gallery-wizard" aria-labelledby="gallery-wizard-h">
      <Stack>
        <h2 id="gallery-wizard-h" className="text-title3 font-semibold">
          {t('section.wizard')}
        </h2>
        <div data-testid="gallery-wizard-ready">
          <ReadyWizard title={title('ready')} />
        </div>
        <div data-testid="gallery-wizard-error">
          {single(() => Promise.reject(new Error('Sample error')), 'error')}
        </div>
        <div data-testid="gallery-wizard-offline">
          <OnlineContext.Provider value={false}>
            {single(async () => undefined, 'offline')}
          </OnlineContext.Provider>
        </div>
      </Stack>
    </section>
  );
}
