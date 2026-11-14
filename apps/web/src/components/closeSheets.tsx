/* eslint-disable i18next/no-literal-string -- prop values only; every visible string goes through t() */
import { useTranslation } from 'react-i18next';
import type { CommandAction, CommandBody, Config, Ticket } from '../api.js';
import { FormSheet } from '../patterns/form-sheet.js';
import { machineLabel } from './format.js';

export interface CloseSheetProps {
  ticket: Ticket;
  config: Config;
  personId: string;
  pending: boolean;
  error: string | null;
  onRun: (action: CommandAction, body: CommandBody) => Promise<boolean>;
  onClose: () => void;
}

/** The server's cap on a close note; a longer one queued offline would be refused on replay. */
const NOTE_MAX = 2000;

/** The two quick closes are one text box each; both queue offline like every close. */
function CloseSheet(
  p: CloseSheetProps & {
    title: string;
    description?: string;
    label: string;
    submit: string;
    kind: 'no_report' | 'done';
  },
) {
  const { t } = useTranslation();
  const name = p.config.people.find((person) => person.id === p.personId)?.name ?? '';
  return (
    <FormSheet
      open
      onOpenChange={(open) => {
        if (!open) p.onClose();
      }}
      title={p.title}
      description={p.description}
      submitLabel={p.submit}
      backLabel={t('closes.back')}
      actingAs={name ? t('closes.actingAs', { name }) : undefined}
      fields={[
        { name: 'note', label: p.label, required: true, multiline: true, maxLength: NOTE_MAX },
      ]}
      offlineAllowed
      pending={p.pending}
      error={p.error}
      onSubmit={(values) =>
        p.onRun('close', { personId: p.personId, kind: p.kind, note: (values.note ?? '').trim() })
      }
    />
  );
}

/** Close without report (S4-1): a reason, and the ticket waits under Needs report. */
export function NoReportSheet(p: CloseSheetProps) {
  const { t } = useTranslation();
  return (
    <CloseSheet
      {...p}
      kind="no_report"
      title={t('closes.noReport.title', { machine: machineLabel(p.ticket, p.config.machines) })}
      description={t('closes.noReport.hint')}
      label={t('closes.noReport.reason')}
      submit={t('closes.noReport.submit')}
    />
  );
}

/** Mark done (S4-2): what was done on a work request. */
export function DoneSheet(p: CloseSheetProps) {
  const { t } = useTranslation();
  return (
    <CloseSheet
      {...p}
      kind="done"
      title={t('closes.done.title', { what: machineLabel(p.ticket, p.config.machines) })}
      description={p.ticket.problem}
      label={t('closes.done.what')}
      submit={t('closes.done.submit')}
    />
  );
}
