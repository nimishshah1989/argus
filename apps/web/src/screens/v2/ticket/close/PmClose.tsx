import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PmChecklistItem } from '@uptimo/shared/pm';
import type { CommandAction, CommandBody, Config, TicketDetail } from '../../../../api.js';
import { machineLabel } from '../../../../components/format.js';
import { Field, ScreenFooter } from '../../../../ui/v2/close-kit.js';
import { Notice } from '../../../../ui/v2/notice.js';
import { TickRow } from '../../../../ui/v2/tick-row.js';
import { CloseHead } from './CloseHead.js';
import {
  emptyDraft,
  METER_KEY,
  planItems,
  pmCloseBody,
  pmReady,
  setReading,
  setTicked,
  type PmDraft,
} from '../../../../components/pmDraft.js';

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
    <Field id={props.id} label={props.label}>
      <input
        id={props.id}
        inputMode="decimal"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </Field>
  );
}

/** The plan's tick points: each starts ticked, and unticking one records it as not done (R5, R8). */
function Checklist(props: { ticks: PmChecklistItem[]; draft: PmDraft; onChange: Draft }) {
  const { t } = useTranslation();
  if (props.ticks.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="v2-h3">{t('pm.close.checklist')}</h3>
      {props.ticks.map((item) => (
        <TickRow
          key={item.id}
          label={t('pm.point', { n: item.point })}
          checked={!props.draft.undone.includes(item.id)}
          onChange={(checked) => props.onChange((current) => setTicked(current, item.id, checked))}
        />
      ))}
    </div>
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
    <div className="flex flex-col gap-2">
      <h3 className="v2-h3">{t('pm.close.readings')}</h3>
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
    </div>
  );
}

/** The one comment box; the close stores it as `comments` (null when empty). */
function Comments(props: { draft: PmDraft; onChange: Draft }) {
  const { t } = useTranslation();
  return (
    <Field id="pm-comments" label={t('pm.close.comment')}>
      <textarea
        id="pm-comments"
        value={props.draft.comments}
        placeholder={t('pm.close.commentPlaceholder')}
        onChange={(event) =>
          props.onChange((current) => ({ ...current, comments: event.target.value }))
        }
      />
    </Field>
  );
}

/** The machine and the plan behind the job. */
function Heading(props: { detail: TicketDetail; config: Config }) {
  return (
    <section className="v2-card v2-pad">
      <h2 className="v2-h2">{machineLabel(props.detail.ticket, props.config.machines)}</h2>
      <p className="v2-lede">{props.detail.pmPlan?.title ?? props.detail.ticket.problem}</p>
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
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <CloseHead title={t('pm.close.title')} onBack={props.onExit} />
      <Heading detail={props.detail} config={props.config} />
      {plan ? null : (
        <Notice tone="info" title={t('pm.close.noPlan')}>
          {t('pm.close.noPlanHint')}
        </Notice>
      )}
      {plan && empty ? <Notice tone="info" title={t('pm.close.noChecklist')} /> : null}
      <Checklist ticks={ticks} draft={draft} onChange={setDraft} />
      <Readings readings={readings} meter={meter} draft={draft} onChange={setDraft} />
      <Comments draft={draft} onChange={setDraft} />
      {props.error ? <Notice tone="error" title={props.error} /> : null}
      <ScreenFooter hint={t('pm.close.hint')}>
        <button type="submit" className="v2-btn v2-btn-primary" disabled={!ready}>
          {props.pending ? t('common.saving') : t('pm.close.submit')}
        </button>
      </ScreenFooter>
    </form>
  );
}
