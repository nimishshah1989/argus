/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible string goes through t() */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PmChecklistItem } from '@uptimo/shared/pm';
import type { CommandAction, CommandBody, Config, TicketDetail } from '../api.js';
import { Banner } from '../ui/banner.js';
import { Button } from '../ui/button.js';
import { ScreenFooter } from '../ui/close-kit.js';
import { Input, Label, Textarea } from '../ui/input.js';
import { Stack } from '../ui/layout.js';
import { TickRow } from '../ui/tick-row.js';
import { TopBar } from '../ui/top-bar.js';
import { machineLabel } from './format.js';
import {
  emptyDraft,
  METER_KEY,
  planItems,
  pmCloseBody,
  pmReady,
  setReading,
  setTicked,
  type PmDraft,
} from './pmDraft.js';

export interface PmCloseProps {
  detail: TicketDetail;
  config: Config;
  personId: string;
  pending: boolean;
  error: string | null;
  command: (action: CommandAction, body: CommandBody) => Promise<boolean>;
  onExit: () => void;
}

type Draft = (update: (current: PmDraft) => PmDraft) => void;

/** One numbered box's reading: a real label, a numeric keypad on a phone, and the plan's own item name (R5). */
function ReadingBox(props: {
  id: string;
  label: string;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        inputMode="decimal"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </div>
  );
}

/** The plan's tick points: each starts ticked, and unticking one records it as not done (R5, R8). */
function Checklist(props: { ticks: PmChecklistItem[]; draft: PmDraft; onChange: Draft }) {
  const { t } = useTranslation();
  if (props.ticks.length === 0) return null;
  return (
    <Stack gap={2}>
      <h3 className="text-footnote font-bold text-neutral-900">{t('pm.close.checklist')}</h3>
      {props.ticks.map((item) => (
        <TickRow
          key={item.id}
          label={t('pm.point', { n: item.point })}
          checked={!props.draft.undone.includes(item.id)}
          onChange={(checked) => props.onChange((current) => setTicked(current, item.id, checked))}
        />
      ))}
    </Stack>
  );
}

/** The plan's measured readings and, when the plan has a meter, the machine's reading (R6). */
function Readings(props: {
  readings: PmChecklistItem[];
  meter: boolean;
  draft: PmDraft;
  onChange: Draft;
}) {
  const { t } = useTranslation();
  const boxes = props.readings.filter((item) => item.kind === 'reading');
  if (boxes.length === 0 && !props.meter) return null;
  return (
    <Stack gap={2}>
      <h3 className="text-footnote font-bold text-neutral-900">{t('pm.close.readings')}</h3>
      {boxes.map((item) => (
        <ReadingBox
          key={item.id}
          id={`pm-reading-${item.id}`}
          label={item.kind === 'reading' ? item.label : item.id}
          value={props.draft.readings[item.id] ?? ''}
          onChange={(text) => props.onChange((current) => setReading(current, item.id, text))}
        />
      ))}
      {props.meter ? (
        <ReadingBox
          id="pm-reading-meter"
          label={t('pm.close.meter')}
          value={props.draft.readings[METER_KEY] ?? ''}
          onChange={(text) => props.onChange((current) => setReading(current, METER_KEY, text))}
        />
      ) : null}
    </Stack>
  );
}

/** The one comment box; the close stores it as `comments` (null when empty). */
function Comments(props: { draft: PmDraft; onChange: Draft }) {
  const { t } = useTranslation();
  return (
    <Stack gap={1}>
      <Label htmlFor="pm-comments">{t('pm.close.comment')}</Label>
      <Textarea
        id="pm-comments"
        value={props.draft.comments}
        placeholder={t('pm.close.commentPlaceholder')}
        onChange={(event) =>
          props.onChange((current) => ({ ...current, comments: event.target.value }))
        }
      />
    </Stack>
  );
}

/** The machine and the plan behind the job. */
function Heading(props: { detail: TicketDetail; config: Config }) {
  return (
    <section className="flex flex-col gap-1 rounded-2xl bg-surface p-4 shadow-card">
      <h2 className="text-title1 font-extrabold leading-tight">
        {machineLabel(props.detail.ticket, props.config.machines)}
      </h2>
      <p className="text-body text-neutral-900">
        {props.detail.pmPlan?.title ?? props.detail.ticket.problem}
      </p>
    </section>
  );
}

/**
 * The PM close (ticket 49c): the plan's numbered checklist, its readings, the machine meter and one comment, closed
 * with `kind: 'report'`. Offline goes through the same command queue as every other close; the server derives the
 * totals and moves the plan, so this screen sends the plan id and what the technician recorded.
 */
export function PmClose(props: PmCloseProps) {
  const { t } = useTranslation();
  const plan = props.detail.pmPlan;
  const [draft, setDraft] = useState<PmDraft>(emptyDraft);
  const { ticks, readings, meter } = planItems(plan);
  const ready = pmReady(plan, draft, props.pending);
  const empty = ticks.length === 0 && readings.length === 0;

  async function submit(): Promise<void> {
    if (!ready) return;
    const body = pmCloseBody(plan, draft, new Date());
    if (await props.command('close', body as CommandBody)) props.onExit();
  }

  return (
    <form
      aria-label={t('pm.close.title')}
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <TopBar
        back={{ onClick: props.onExit, label: t('common.back') }}
        trailing={<h1 className="text-footnote text-neutral-600">{t('pm.close.title')}</h1>}
      />
      <main className="flex flex-1 flex-col gap-4 p-4">
        <Heading detail={props.detail} config={props.config} />
        {plan ? null : (
          <Banner tone="info" title={t('pm.close.noPlan')}>
            {t('pm.close.noPlanHint')}
          </Banner>
        )}
        {plan && empty ? <Banner tone="info" title={t('pm.close.noChecklist')} /> : null}
        <Checklist ticks={ticks} draft={draft} onChange={setDraft} />
        <Readings readings={readings} meter={meter} draft={draft} onChange={setDraft} />
        <Comments draft={draft} onChange={setDraft} />
        {props.error ? <Banner tone="error" title={props.error} /> : null}
      </main>
      <ScreenFooter hint={t('pm.close.hint')}>
        <Button type="submit" disabled={!ready}>
          {props.pending ? t('common.saving') : t('pm.close.submit')}
        </Button>
      </ScreenFooter>
    </form>
  );
}
