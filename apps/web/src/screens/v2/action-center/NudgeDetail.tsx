/* eslint-disable i18next/no-literal-string -- typed keys and icon names only; every visible word comes from the model */
import { useState } from 'react';
import { Button } from '../../../ui/v2/button.js';
import { AckForm } from '../../../ui/v2/domain/ack-form.js';
import { DetailFigure, DetailSection, SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { EntityChip } from '../../../ui/v2/entity-chip.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { Segs } from '../../../ui/v2/points.js';
import type { ActionCenterActions, ActionCenterModel, NudgeRow } from './model.js';

const PILL = { high: 'loss', med: 'risk', low: 'neutral', info: 'gain' } as const;

/** What was done to a stored nudge: who owns it (or that nobody does), when it is due, and the note. */
function Stored({ row, model }: { row: NudgeRow; model: ActionCenterModel }) {
  const { ack } = row;
  const { words } = model;
  if (ack === null) return null;
  return (
    <DetailSection label={words.detail.stored}>
      <ul className="v2-points">
        <li>
          {words.owner}{' '}
          {ack.owner.length > 0 ? <Segs point={ack.owner} /> : <span>{words.ownerNone}</span>}
        </li>
        {[ack.due, ack.note].map((line) => (line === '' ? null : <li key={line}>{line}</li>))}
      </ul>
    </DetailSection>
  );
}

/** The buttons one nudge offers: the three writes on an open one, Reopen on a stored one, none on good news. */
function Buttons({
  row,
  model,
  acts,
  onForm,
}: {
  row: NudgeRow;
  model: ActionCenterModel;
  acts: ActionCenterActions;
  onForm: () => void;
}) {
  const { words } = model;
  const can = (action: NudgeRow['actions'][number]) => row.actions.includes(action);
  const busy = acts.saving === true;
  return (
    <div className="v2-row v2-gap-8">
      {can('ack') ? (
        <Button primary onClick={onForm}>
          {words.actions.acknowledge}
        </Button>
      ) : null}
      {can('snooze') ? (
        <Button onClick={() => !busy && acts.onSnooze?.(row.writeKey)}>
          {words.actions.snooze}
        </Button>
      ) : null}
      {can('resolved') ? (
        <Button onClick={() => !busy && acts.onResolve?.(row.writeKey)}>
          {words.actions.resolve}
        </Button>
      ) : null}
      {can('reopen') ? (
        <Button primary onClick={() => !busy && acts.onReopen?.(row.writeKey)}>
          {words.actions.reopen}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * One nudge in the drawer: what it says, how many entries stand behind it and the latest, the machines it names,
 * what was stored on it, and what a person can do. One acknowledgement form at a time, because one nudge is open.
 */
export function NudgeDetail({
  row,
  model,
  acts,
}: {
  row: NudgeRow;
  model: ActionCenterModel;
  acts: ActionCenterActions;
}) {
  const { words } = model;
  const [form, setForm] = useState(false);
  return (
    <div className="v2-detail">
      <div className="v2-row v2-gap-8">
        <KeyPill text={row.severityLabel} tone={PILL[row.severity]} />
        <KeyPill text={row.ruleLabel} tone="neutral" />
        <KeyPill text={row.statusLabel} tone="neutral" />
        {row.reopened ? <KeyPill text={words.reopened} tone="risk" icon="alert" /> : null}
        {row.excluded ? <KeyPill text={words.excluded} tone="neutral" icon="pause" /> : null}
      </div>
      <h2 className="v2-drawer-title">{row.titleText}</h2>
      <DetailSection label={words.detail.about}>
        <div className="v2-figures">
          <DetailFigure label={words.columns.entries} value={row.entries} />
          <DetailFigure label={words.detail.latest} value={row.latest.shown} />
        </div>
      </DetailSection>
      {row.machines.length > 0 ? (
        <DetailSection label={words.detail.machines}>
          <div className="v2-row v2-gap-8">
            {row.machines.map((chip) => (
              <EntityChip key={chip.id} {...chip} />
            ))}
          </div>
        </DetailSection>
      ) : null}
      <Stored row={row} model={model} />
      {row.actions.length > 0 ? (
        <DetailSection label={words.detail.actions}>
          <Buttons row={row} model={model} acts={acts} onForm={() => setForm(true)} />
          {form && row.actions.includes('ack') ? (
            <AckForm
              words={words.form}
              people={model.people}
              saving={acts.saving === true}
              onSave={(body) => {
                acts.onAck?.(row.writeKey, body);
                setForm(false);
              }}
              onCancel={() => setForm(false)}
            />
          ) : null}
        </DetailSection>
      ) : null}
      {acts.failed ? (
        <p role="alert" className="v2-sub v2-seg-loss">
          {words.saveFailed}
        </p>
      ) : null}
      <SourceLine text={model.source} />
    </div>
  );
}
