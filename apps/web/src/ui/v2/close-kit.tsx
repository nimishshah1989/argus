import type { ReactNode } from 'react';

/** The pieces of the ticket's close screens on the kit (styles in close.css). */

export interface FinishTimeProps {
  title: string;
  /** Names the time for assistive tech, e.g. "Finish time". */
  label: string;
  time: string;
  /** Right of the time: "Now" or how long ago. */
  status: string;
  hint: string;
  earlier: string;
  now: string;
  later: string;
  canEarlier: boolean;
  canNow: boolean;
  /** The finish is the moment the screen opened: the Now step shows as selected. */
  isNow: boolean;
  canLater: boolean;
  onEarlier: () => void;
  onNow: () => void;
  onLater: () => void;
}

function StepButton(p: { label: string; enabled: boolean; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="v2-btn v2-btn-ghost"
      disabled={!p.enabled}
      aria-pressed={p.pressed}
      onClick={p.onClick}
    >
      {p.label}
    </button>
  );
}

/** "When did you finish?": the time large, then three buttons that move it in steps. */
export function FinishTime(p: FinishTimeProps) {
  return (
    <section className="v2-card v2-pad">
      <h2 className="v2-h2">{p.title}</h2>
      <div className="v2-finish-time">
        <output aria-label={p.label}>{p.time}</output>
        <span className="v2-sub">{p.status}</span>
      </div>
      <div className="v2-finish-steps">
        <StepButton
          label={p.earlier}
          enabled={p.canEarlier}
          pressed={false}
          onClick={p.onEarlier}
        />
        <StepButton label={p.now} enabled={p.canNow} pressed={p.isNow} onClick={p.onNow} />
        <StepButton label={p.later} enabled={p.canLater} pressed={false} onClick={p.onLater} />
      </div>
      <p className="v2-sub">{p.hint}</p>
    </section>
  );
}

/** A hint line over the screen's one primary button, pinned to the foot of the page. */
export function ScreenFooter({ hint, children }: { hint: string; children: ReactNode }) {
  return (
    <div className="v2-close-foot">
      <p>{hint}</p>
      {children}
    </div>
  );
}

/** A label over one control; `id` is the control's id. */
export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="v2-close-field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

/** A labelled choice: an empty first option, then the options. */
export function ChoiceField(props: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  /** The empty option's words ("Select", or a dash for "nobody"). */
  empty: string;
}) {
  return (
    <Field id={props.id} label={props.label}>
      <select
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        <option value="">{props.empty}</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Label left, value right, one row per fact. */
export function FactRows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="v2-card v2-pad v2-fact-rows">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Three figures side by side: a small label over the number. */
export function MinuteTiles({ tiles }: { tiles: { label: string; value: string }[] }) {
  return (
    <dl className="v2-minute-tiles">
      {tiles.map((tile) => (
        <div key={tile.label} className="v2-card v2-pad">
          <dt>{tile.label}</dt>
          <dd>{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}
