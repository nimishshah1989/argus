import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { raiseTicket, type Ticket } from '../../api.js';
import { WizardPage } from '../../patterns/wizard-page.js';
import { Stack } from '../../ui/layout.js';
import { FloorShell, FloorWaiting } from './floor-shell.js';
import { EMPTY, Fields, type Form } from './other-work-fields.js';
import { WhoIsReporting } from './problem-step.js';
import { Sent } from './sent.js';
import { FLOOR, useFloorData } from './use-floor.js';

/** Other work (not a machine): a work request in one step (A2-3, v3.reporting.06). */
export function OtherWork() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const load = useFloorData();
  const data = load.data;
  const [form, setForm] = useState<Form>(EMPTY);
  const [startNow, setStartNow] = useState(false);
  const [sent, setSent] = useState<Ticket | null>(null);
  if (!data)
    return (
      <FloorShell>
        <FloorWaiting load={load} />
      </FloorShell>
    );
  const location = form.typed.trim() || form.place;
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  async function send(): Promise<void> {
    const body = { kind: 'general' as const, location, workType: form.workType };
    const reply = await raiseTicket({
      ...body,
      problem: form.needed.trim(),
      urgent: form.urgent,
      startNow,
    });
    setSent(reply.ticket);
    await queryClient.invalidateQueries({ queryKey: ['tickets'] });
  }
  const body = (
    <Stack gap={4}>
      <Fields data={data} form={form} set={set} />
      <WhoIsReporting data={data} startNow={startNow} onStartNow={setStartNow} />
    </Stack>
  );
  const step = {
    title: t('reportFloor.other'),
    body,
    back: t('nav.report'),
    onBack: () => navigate(FLOOR.report),
  };
  const ready = Boolean(location && form.workType && form.needed.trim());
  return (
    <FloorShell>
      <WizardPage
        title={t('floor.title')}
        quietOnline
        aside={t('floor.workRequest')}
        steps={[{ ...step, action: t('reportFloor.sendWork'), ready }]}
        offlineAllowed={false}
        onFinish={send}
        result={
          sent ? <Sent data={data} ticket={sent} onAnother={() => navigate(FLOOR.report)} /> : null
        }
      />
    </FloorShell>
  );
}
