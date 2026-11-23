import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DetailFigure, DetailSection, SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { EntityChip } from '../../../ui/v2/entity-chip.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { KIND_TONE } from '../../../ui/v2/domain/decision-row.js';
import {
  FOCUS_LANES,
  FOCUS_LANE_HINTS,
  FOCUS_LANE_LABELS,
} from '../../analytics/team-focus-actions.js';
import { STORED_OF } from './adapter.js';
import type { ActionRow, ActionStatus, NoteChange, TeamFocusModel } from './model.js';
import { laneTally, ownerRows } from './writes.js';

const STATUSES: ActionStatus[] = ['todo', 'doing', 'done', 'skip'];

/** Status, owner and note of one action; Save sends all three and says whether it went through. */
function EditForm({ row, onSave }: { row: ActionRow; onSave: (change: NoteChange) => unknown }) {
  const { t } = useTranslation();
  const id = useId();
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'failed'>('idle');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === 'busy') return;
    const data = new FormData(event.currentTarget);
    setState('busy');
    Promise.resolve(
      onSave({
        status: String(data.get('status')) as ActionStatus,
        owner: String(data.get('owner') ?? '').trim(),
        note: String(data.get('note') ?? ''),
      }),
    ).then(
      () => setState('saved'),
      () => setState('failed'),
    );
  };
  return (
    <form className="v2-ack-form" onSubmit={submit}>
      <div className="v2-ack-field">
        <label htmlFor={`${id}-status`}>{t('v2tf.edit.status')}</label>
        <select id={`${id}-status`} name="status" defaultValue={row.status}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`analytics.teamFocus.status.${STORED_OF[s]}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="v2-ack-field">
        <label htmlFor={`${id}-owner`}>{t('v2tf.edit.owner')}</label>
        <input
          id={`${id}-owner`}
          name="owner"
          type="text"
          maxLength={80}
          defaultValue={row.owner?.label ?? ''}
        />
      </div>
      <div className="v2-ack-field">
        <label htmlFor={`${id}-note`}>{t('v2tf.edit.note')}</label>
        <textarea id={`${id}-note`} name="note" maxLength={500} defaultValue={row.note} />
      </div>
      <div className="v2-row v2-gap-8">
        <button type="submit" className="v2-btn v2-btn-primary" aria-busy={state === 'busy'}>
          {t('v2tf.edit.save')}
        </button>
        {state === 'saved' ? <span className="v2-sub">{t('v2tf.edit.saved')}</span> : null}
        {state === 'failed' ? (
          <span role="alert" className="v2-sub v2-seg-loss">
            {t('v2tf.edit.failed')}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/** One action of the month in the drawer: what it is, how much of its lane is open, and the form that edits it. */
export function ActionDetail({
  model,
  row,
  canSave,
  onSave,
}: {
  model: TeamFocusModel;
  row: ActionRow;
  canSave: boolean;
  onSave: (change: NoteChange) => unknown;
}) {
  const { t } = useTranslation();
  const tally = laneTally(model, row.id);
  const lane = FOCUS_LANES.find((l) => t(FOCUS_LANE_LABELS[l]) === row.kindLabel);
  return (
    <div className="v2-detail">
      <div className="v2-row v2-gap-8">
        <KeyPill text={row.kindLabel} tone={KIND_TONE[row.kind]} />
        {row.chips.map((c) => (
          <EntityChip key={c.id} {...c} />
        ))}
      </div>
      <h2 className="v2-drawer-title">{row.title}</h2>
      <div className="v2-figures">
        <DetailFigure label={model.words.actions.columns.hours} value={row.hours.shown} />
      </div>
      <DetailSection label={row.kindLabel}>
        {lane ? <p className="v2-sub">{t(FOCUS_LANE_HINTS[lane])}</p> : null}
        {tally ? <p className="v2-sub">{t('analytics.teamFocus.openOf', tally)}</p> : null}
      </DetailSection>
      {canSave ? (
        <EditForm key={`${row.status}|${row.owner?.label}|${row.note}`} row={row} onSave={onSave} />
      ) : (
        <p className="v2-sub">{t('v2tf.edit.noMonth')}</p>
      )}
      <SourceLine text={model.source} />
    </div>
  );
}

/** An owner in the drawer: the month's actions they hold, each with its status and hours. */
export function OwnerDetail({ model, chipId }: { model: TeamFocusModel; chipId: string }) {
  const { t } = useTranslation();
  const rows = ownerRows(model, chipId);
  return (
    <div className="v2-detail">
      <DetailSection label={t('v2tf.owner.actions', { owner: rows[0]?.owner?.label ?? '' })}>
        <ul className="v2-points">
          {rows.map((r) => (
            <li key={r.id}>
              {r.title} · {r.statusLabel} · {r.hours.shown}
            </li>
          ))}
        </ul>
      </DetailSection>
      <SourceLine text={model.source} />
    </div>
  );
}
