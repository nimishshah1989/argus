/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible word comes from the model */
import { type ReactNode } from 'react';
import {
  FieldLabel,
  Line,
  QuickChip,
  SelectBox,
  TextArea,
  TextInput,
} from '../../../ui/v2/floor-kit.js';
import { Wizard } from '../../../ui/v2/wizard.js';
import type { OtherWorkForm, OtherWorkModel } from './model.js';
import { Who, SentView } from './report-steps.js';

/** The "Other work" flow: its form, urgency chips and wizard, beside the report flow in `View.tsx`. */

export type OtherWorkActions = {
  onForm: (patch: Partial<OtherWorkForm>) => void;
  onStartNow: (on: boolean) => void;
  onBack: () => void;
  onSend: () => Promise<void>;
  onAnother: () => void;
  onMine: () => void;
};

function Urgency({ m, on }: { m: OtherWorkModel; on: OtherWorkActions }) {
  return (
    <div className="v2-floor-field-group">
      <span className="v2-floor-label">{m.urgency.label}</span>
      <div className="v2-floor-chips">
        <QuickChip
          label={m.urgency.normal}
          pressed={!m.form.urgent}
          onClick={() => on.onForm({ urgent: false })}
        />
        <QuickChip
          label={m.urgency.urgent}
          pressed={m.form.urgent}
          onClick={() => on.onForm({ urgent: true })}
        />
      </div>
    </div>
  );
}

function OtherWorkBody({ m, on }: { m: OtherWorkModel; on: OtherWorkActions }) {
  return (
    <div className="flex flex-col gap-4">
      <Line quiet>{m.intro}</Line>
      <div className="v2-floor-field-group">
        <FieldLabel htmlFor="other-place">{m.where.label}</FieldLabel>
        <SelectBox
          id="other-place"
          value={m.form.place}
          onChange={(e) => on.onForm({ place: e.target.value })}
        >
          <option value="">{m.where.choose}</option>
          {m.where.places.map((place) => (
            <option key={place}>{place}</option>
          ))}
        </SelectBox>
        <TextInput
          aria-label={m.where.typedLabel}
          placeholder={m.where.typedLabel}
          value={m.form.typed}
          onChange={(e) => on.onForm({ typed: e.target.value })}
        />
      </div>
      <div className="v2-floor-field-group">
        <FieldLabel htmlFor="other-type">{m.workType.label}</FieldLabel>
        <SelectBox
          id="other-type"
          value={m.form.workType}
          onChange={(e) => on.onForm({ workType: e.target.value })}
        >
          <option value="">{m.workType.choose}</option>
          {m.workType.types.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </SelectBox>
      </div>
      <div className="v2-floor-field-group">
        <FieldLabel htmlFor="other-needed">{m.needed.label}</FieldLabel>
        <TextArea
          id="other-needed"
          placeholder={m.needed.placeholder}
          value={m.form.needed}
          onChange={(e) => on.onForm({ needed: e.target.value })}
        />
      </div>
      <Urgency m={m} on={on} />
      <Who who={m.who} onStartNow={on.onStartNow} />
    </div>
  );
}

/** Other work: one wizard step titled "Other work (not a machine)", aside "Work request", back "Report". */
export function OtherWorkView(p: { model: OtherWorkModel; on: OtherWorkActions }): ReactNode {
  const { model: m, on } = p;
  return (
    <Wizard
      title={m.title}
      quietOnline
      aside={m.aside}
      steps={[
        {
          title: m.stepTitle,
          body: <OtherWorkBody m={m} on={on} />,
          back: m.back,
          onBack: on.onBack,
          action: m.action,
          ready: m.ready,
        },
      ]}
      offlineAllowed={false}
      onFinish={on.onSend}
      result={
        m.sent ? <SentView model={m.sent} onAnother={on.onAnother} onMine={on.onMine} /> : null
      }
    />
  );
}
