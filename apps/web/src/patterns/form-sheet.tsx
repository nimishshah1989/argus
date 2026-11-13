import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../data/index.js';
import { Button } from '../ui/button.js';
import { Input, Label } from '../ui/input.js';
import { Stack } from '../ui/layout.js';
import { Sheet } from '../ui/sheet.js';
import { offlineNotice } from './view-state.js';

export interface FormField {
  name: string;
  label: string;
  required?: boolean;
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
}

/** A sheet with labelled inputs; required fields only, no schema (the server is the validator). */
export function FormSheet(p: FormSheetProps) {
  const { t } = useTranslation();
  const online = useOnline();
  const [values, setValues] = useState<Record<string, string>>(p.initial ?? {});
  const notice = offlineNotice(online, p.offlineAllowed);
  const missing = p.fields.some((f) => f.required && (values[f.name] ?? '').trim() === '');

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (await p.onSubmit(values)) {
      setValues({});
      p.onOpenChange(false);
    }
  }

  return (
    <Sheet open={p.open} onOpenChange={p.onOpenChange} title={p.title}>
      <form aria-label={p.title} onSubmit={(event) => void submit(event)}>
        <Stack gap={3}>
          {p.fields.map((field) => (
            <Stack key={field.name} gap={1}>
              <Label htmlFor={`form-${field.name}`}>{field.label}</Label>
              <Input
                id={`form-${field.name}`}
                required={field.required}
                value={values[field.name] ?? ''}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
              />
            </Stack>
          ))}
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
          <Button
            type="submit"
            disabled={p.pending || missing || notice === 'kit.form.needsConnection'}
          >
            {p.pending ? t('common.sending') : p.submitLabel}
          </Button>
        </Stack>
      </form>
    </Sheet>
  );
}
