/* eslint-disable i18next/no-literal-string -- prop values only; every visible string goes through t() */
import { useTranslation } from 'react-i18next';
import type { Config } from '../api.js';
import { Field } from '../ui/close-kit.js';
import { Input, Select, Textarea } from '../ui/input.js';
import { Grid, Stack } from '../ui/layout.js';
import {
  DONE_SLOTS,
  activePeople,
  categoryOptions,
  listOptions,
  shiftOptions,
  type ReportValues,
} from './reportFields.js';

export interface SectionProps {
  values: ReportValues;
  update: (patch: Partial<ReportValues>) => void;
  config: Config;
}

/** The server's caps on the report's one-line boxes. */
const TEXT_MAX = { spareUsed: 200, handoverName: 120 } as const;

interface Option {
  value: string;
  label: string;
}

function Choice(props: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  /** An optional box shows a dash for "nobody". */
  empty?: string;
}) {
  const { t } = useTranslation();
  return (
    <Field id={props.id} label={props.label}>
      <Select
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        <option value="">{props.empty ?? t('closes.form.select')}</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
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
    <Stack gap={3}>
      <Field id="report-machine" label={t('closes.form.machine')}>
        <Input id="report-machine" readOnly value={machineCode} />
      </Field>
      <Grid columns={2} gap={3}>
        <Field id="report-date" label={t('closes.form.date')}>
          <Input id="report-date" readOnly value={formatDay(values.date)} />
        </Field>
        <Choice
          id="report-shift"
          label={t('closes.form.shift')}
          value={values.shiftCode}
          options={shiftOptions(config.shifts)}
          onChange={(shiftCode) => update({ shiftCode })}
        />
      </Grid>
      <Field id="report-problem" label={t('closes.form.problem')}>
        <Textarea
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
        <Textarea
          id="report-corrective"
          maxLength={4000}
          placeholder={t('closes.form.correctivePlaceholder')}
          value={values.correctiveAction}
          onChange={(event) => update({ correctiveAction: event.target.value })}
        />
      </Field>
    </Stack>
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
    <Stack gap={3}>
      {done(0)}
      <Grid columns={2} gap={3}>
        {done(1)}
        {done(2)}
      </Grid>
      <Choice
        id="report-supported"
        label={t('closes.form.supportedBy')}
        value={values.supportedBy}
        options={people}
        empty={t('closes.form.none')}
        onChange={(supportedBy) => update({ supportedBy })}
      />
    </Stack>
  );
}

/** The down time (read only), the classification, the spare and the handover. */
export function Classification({ values, update, config }: SectionProps) {
  const { t } = useTranslation();
  const field = (id: string, label: string, key: 'spareUsed' | 'handoverName', hint: string) => (
    <Field id={id} label={label}>
      <Input
        id={id}
        placeholder={hint}
        maxLength={TEXT_MAX[key]}
        value={values[key]}
        onChange={(event) => update({ [key]: event.target.value })}
      />
    </Field>
  );
  return (
    <Stack gap={3}>
      <Field id="report-downtime" label={t('closes.form.downtime')}>
        <Input id="report-downtime" readOnly value={values.downtimeMin} />
      </Field>
      <Choice
        id="report-category"
        label={t('closes.form.category')}
        value={values.breakdownCategory}
        options={categoryOptions(config)}
        onChange={(breakdownCategory) => update({ breakdownCategory })}
      />
      <Choice
        id="report-maint"
        label={t('closes.form.maintCode')}
        value={values.maintCode}
        options={listOptions(config, 'maint_code')}
        onChange={(maintCode) => update({ maintCode })}
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
    </Stack>
  );
}
