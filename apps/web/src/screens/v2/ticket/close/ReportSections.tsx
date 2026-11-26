/* eslint-disable i18next/no-literal-string -- prop values only; every visible string goes through t() */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getRecentCodes, type Config } from '../../../../api.js';
import { ChoiceField, Field } from '../../../../ui/v2/close-kit.js';
import { CodePicker, type CodeOption } from '../../../../ui/v2/code-picker.js';
import {
  DONE_SLOTS,
  activePeople,
  categoryOptions,
  codeOptions,
  shiftOptions,
  type ReportValues,
} from '../../../../components/reportFields.js';

export interface SectionProps {
  values: ReportValues;
  update: (patch: Partial<ReportValues>) => void;
  config: Config;
}

/** The server's caps on the report's one-line boxes. */
const TEXT_MAX = { spareUsed: 200, handoverName: 120 } as const;

/** A report list: "Select" first, or a dash for "nobody" on an optional box. */
function Choice(props: Omit<Parameters<typeof ChoiceField>[0], 'empty'> & { empty?: string }) {
  const { t } = useTranslation();
  return <ChoiceField {...props} empty={props.empty ?? t('closes.form.select')} />;
}

/** A calendar day such as 2026-11-14 as "14 Nov 2026". */
function formatDay(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

/** Machine, date, shift, the problem and what was done (the top of v3's form). */
export function WhatHappened({
  values,
  update,
  config,
  machineCode,
}: SectionProps & { machineCode: string }) {
  const { t } = useTranslation();
  const names = activePeople(config.people).map((person) => ({
    value: person.name,
    label: person.name,
  }));
  return (
    <div className="flex flex-col gap-3">
      <Field id="report-machine" label={t('closes.form.machine')}>
        <input id="report-machine" readOnly value={machineCode} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="report-date" label={t('closes.form.date')}>
          <input id="report-date" readOnly value={formatDay(values.date)} />
        </Field>
        <Choice
          id="report-shift"
          label={t('closes.form.shift')}
          value={values.shiftCode}
          options={shiftOptions(config.shifts)}
          onChange={(shift) => update({ shiftCode: shift })}
        />
      </div>
      <Field id="report-problem" label={t('closes.form.problem')}>
        <textarea
          id="report-problem"
          maxLength={2000}
          value={values.problem}
          onChange={(event) => update({ problem: event.target.value })}
        />
      </Field>
      <Choice
        id="report-observed"
        label={t('closes.form.observedBy')}
        value={values.observedBy}
        options={names}
        onChange={(observedBy) => update({ observedBy })}
      />
      <Field id="report-corrective" label={t('closes.form.correctiveAction')}>
        <textarea
          id="report-corrective"
          maxLength={4000}
          placeholder={t('closes.form.correctivePlaceholder')}
          value={values.correctiveAction}
          onChange={(event) => update({ correctiveAction: event.target.value })}
        />
      </Field>
    </div>
  );
}

const DONE_LABELS = ['closes.form.doneBy', 'closes.form.doneBy2', 'closes.form.doneBy3'] as const;

/** Done By (three boxes, the first required) and Supported By (one). */
export function WhoDidIt({ values, update, config }: SectionProps) {
  const { t } = useTranslation();
  const people = activePeople(config.people).map((p) => ({ value: p.id, label: p.name }));
  const done = (slot: number) => (
    <Choice
      key={slot}
      id={`report-done-${slot}`}
      label={t(DONE_LABELS[slot]!)}
      value={values.doneBy[slot] ?? ''}
      options={people}
      empty={slot === 0 ? undefined : t('closes.form.none')}
      onChange={(id) => {
        const doneBy = Array.from({ length: DONE_SLOTS }, (_, i) => values.doneBy[i] ?? '');
        doneBy[slot] = id;
        update({ doneBy });
      }}
    />
  );
  return (
    <div className="flex flex-col gap-3">
      {done(0)}
      <div className="grid grid-cols-2 gap-3">
        {done(1)}
        {done(2)}
      </div>
      <Choice
        id="report-supported"
        label={t('closes.form.supportedBy')}
        value={values.supportedBy}
        options={people}
        empty={t('closes.form.none')}
        onChange={(supportedBy) => update({ supportedBy })}
      />
    </div>
  );
}

/** A coded list of the close as a searchable pick with this login's last codes on top. */
function Coded(props: {
  id: string;
  label: string;
  value: string;
  options: CodeOption[];
  recent: readonly string[] | undefined;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <CodePicker
      {...props}
      recent={props.recent ?? []}
      empty={t('closes.form.select')}
      search={t('closes.form.searchCodes')}
      recentLabel={t('closes.form.usedLast')}
      allLabel={t('closes.form.allCodes')}
    />
  );
}

/** The down time (read only), the classification, the spare and the handover. */
export function Classification({ values, update, config }: SectionProps) {
  const { t } = useTranslation();
  // An extra: offline or refused, the lists still work, just without the recent codes on top.
  const recent = useQuery({ queryKey: ['recent-codes'], queryFn: getRecentCodes, retry: false });
  const field = (id: string, label: string, key: 'spareUsed' | 'handoverName', hint: string) => (
    <Field id={id} label={label}>
      <input
        id={id}
        placeholder={hint}
        maxLength={TEXT_MAX[key]}
        value={values[key]}
        onChange={(event) => update({ [key]: event.target.value })}
      />
    </Field>
  );
  return (
    <div className="flex flex-col gap-3">
      <Field id="report-downtime" label={t('closes.form.downtime')}>
        <input id="report-downtime" readOnly value={values.downtimeMin} />
      </Field>
      <Coded
        id="report-category"
        label={t('closes.form.category')}
        value={values.breakdownCategory}
        options={categoryOptions(config)}
        recent={recent.data?.breakdownCategory}
        onChange={(breakdownCategory) => update({ breakdownCategory })}
      />
      {/* R2: the floor keeps the plant's word; only where the options come from changed (ticket 47). */}
      <Coded
        id="report-maint"
        label={t('closes.form.maintCode')}
        value={values.failureComponent}
        options={codeOptions(config)}
        recent={recent.data?.failureComponent}
        onChange={(failureComponent) => update({ failureComponent })}
      />
      {field(
        'report-spare',
        t('closes.form.spare'),
        'spareUsed',
        t('closes.form.sparePlaceholder'),
      )}
      {field(
        'report-handover',
        t('closes.form.handover'),
        'handoverName',
        t('closes.form.handoverPlaceholder'),
      )}
    </div>
  );
}
