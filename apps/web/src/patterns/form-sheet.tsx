/* eslint-disable i18next/no-literal-string -- prop values only; every visible string goes through t() */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../data/index.js';
import { Button } from '../ui/button.js';
import { ArrowRightLeft } from '../ui/icon.js';
import { Input, Label, Select, Textarea } from '../ui/input.js';
import { Grid, Stack } from '../ui/layout.js';
import { SegmentedBar } from '../ui/segmented-bar.js';
import { Sheet } from '../ui/sheet.js';
import { offlineNotice } from './view-state.js';

export interface FormField {
  name: string;
  label: string;
  required?: boolean;
  /** A taller text box for a sentence or two. */
  multiline?: boolean;
  /** Longest text the server accepts; the box stops there so a queued command is never refused. */
  maxLength?: number;
  /** `choice` picks one of `choices` (a bar for up to four, a menu for more); `time` is HH:MM. */
  kind?: 'text' | 'time' | 'choice';
  choices?: { value: string; label: string }[];
}
export interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  fields: FormField[];
  offlineAllowed: boolean;
  pending: boolean;
  error: string | null;
  /** True closes the sheet and clears the fields. */
  onSubmit: (values: Record<string, string>) => Promise<boolean>;
  /** First values of the fields; default {}. */
  initial?: Record<string, string>;
  /** A line under the title. */
  description?: string;
  /** "Acting as <name>", above the button. */
  actingAs?: string;
  /** With it, a "Go back" button sits left of the submit button. */
  backLabel?: string;
  /** A line shown under the fields, from what they hold now (a cell change says what it will move). */
  note?: (values: Record<string, string>) => string | null;
  /** A small line under the button. */
  footnote?: string;
}

function Choice(props: { field: FormField; value: string; onChange: (value: string) => void }) {
  const { field } = props;
  const choices = field.choices ?? [];
  if (choices.length > 4)
    return (
      <Select
        id={`form-${field.name}`}
        required={field.required}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        <option value="" />
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>
    );
  return (
    <SegmentedBar
      label={field.label}
      items={choices.map((c) => ({ id: c.value, label: c.label }))}
      selected={props.value}
      onSelect={props.onChange}
    />
  );
}

function Footnote({ text }: { text?: string }) {
  return text ? <p className="text-center text-caption text-neutral-600">{text}</p> : null;
}

function NoteLine({ note }: { note: string | null }) {
  return note ? (
    <p className="flex items-start gap-2 rounded-xl bg-info-tint p-3 text-footnote text-info-ink">
      <ArrowRightLeft aria-hidden size={18} className="mt-0.5" />
      {note}
    </p>
  ) : null;
}

function FieldRow(props: { field: FormField; value: string; onChange: (value: string) => void }) {
  const { field } = props;
  const Control = field.multiline ? Textarea : Input;
  return (
    <Stack gap={1}>
      <Label htmlFor={`form-${field.name}`}>{field.label}</Label>
      {field.kind === 'choice' ? (
        <Choice {...props} />
      ) : (
        <Control
          id={`form-${field.name}`}
          type={field.kind === 'time' ? 'time' : undefined}
          required={field.required}
          maxLength={field.maxLength}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
      )}
    </Stack>
  );
}

/** A sheet with labelled inputs; required fields only, no schema (the server is the validator). */
export function FormSheet(p: FormSheetProps) {
  const { t } = useTranslation();
  const online = useOnline();
  const [values, setValues] = useState<Record<string, string>>(p.initial ?? {});
  const notice = offlineNotice(online, p.offlineAllowed);
  const note = p.note?.(values) ?? null;
  const missing = p.fields.some((f) => f.required && (values[f.name] ?? '').trim() === '');

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (await p.onSubmit(values)) {
      setValues({});
      p.onOpenChange(false);
    }
  }

  const submitButton = (
    <Button type="submit" disabled={p.pending || missing || notice === 'kit.form.needsConnection'}>
      {p.pending ? t('common.sending') : p.submitLabel}
    </Button>
  );

  return (
    <Sheet open={p.open} onOpenChange={p.onOpenChange} title={p.title}>
      <form aria-label={p.title} onSubmit={(event) => void submit(event)}>
        <Stack gap={3}>
          {p.description ? <p className="text-footnote text-neutral-600">{p.description}</p> : null}
          {p.fields.map((field) => (
            <FieldRow
              key={field.name}
              field={field}
              value={values[field.name] ?? ''}
              onChange={(value) => setValues({ ...values, [field.name]: value })}
            />
          ))}
          <NoteLine note={note} />
          {p.actingAs ? <p className="text-footnote text-neutral-600">{p.actingAs}</p> : null}
          {notice ? (
            <p role="status" className="text-footnote text-neutral-600">
              {t(notice)}
            </p>
          ) : null}
          {p.error ? (
            <p role="alert" className="text-body text-danger">
              {p.error}
            </p>
          ) : null}
          {p.backLabel ? (
            <Grid columns={2} gap={2}>
              <Button variant="secondary" onClick={() => p.onOpenChange(false)}>
                {p.backLabel}
              </Button>
              {submitButton}
            </Grid>
          ) : (
            submitButton
          )}
          <Footnote text={p.footnote} />
        </Stack>
      </form>
    </Sheet>
  );
}
