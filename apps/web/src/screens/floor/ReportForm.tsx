import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  raiseTicket,
  type Config,
  type ListItem,
  type RaiseKind,
  type RaiseTicketBody,
} from '../../api.js';
import { Chip } from './Chip.js';
import { MachinePicker } from './MachinePicker.js';
import { SituationPicker } from './SituationPicker.js';

const inputClass = 'min-h-13 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base';

interface ReportValues {
  search: string;
  segmentId: string;
  groupId: string;
  machineId: string;
  kind: RaiseKind;
  location: string;
  workType: string;
  problem: string;
}

const EMPTY_REPORT: ReportValues = {
  search: '',
  segmentId: '',
  groupId: '',
  machineId: '',
  kind: 'stopped',
  location: '',
  workType: '',
  problem: '',
};

type Update = (patch: Partial<ReportValues>) => void;

function GeneralFields({ values, update }: { values: ReportValues; update: Update }) {
  const { t } = useTranslation();
  return (
    <section className="space-y-4">
      <div>
        <label htmlFor="location" className="text-sm font-medium text-neutral-600">
          {t('floor.where')}
        </label>
        <input
          id="location"
          value={values.location}
          onChange={(event) => update({ location: event.target.value })}
          placeholder={t('floor.wherePlaceholder')}
          className={`mt-2 ${inputClass}`}
        />
      </div>
      <div>
        <label htmlFor="workType" className="text-sm font-medium text-neutral-600">
          {t('floor.workType')}
        </label>
        <input
          id="workType"
          value={values.workType}
          onChange={(event) => update({ workType: event.target.value })}
          placeholder={t('floor.workTypePlaceholder')}
          className={`mt-2 ${inputClass}`}
        />
      </div>
    </section>
  );
}

interface ProblemProps {
  problem: string;
  isGeneral: boolean;
  quickProblems: ListItem[];
  onChange: (value: string) => void;
}

function ProblemField({ problem, isGeneral, quickProblems, onChange }: ProblemProps) {
  const { t } = useTranslation();
  return (
    <section>
      <label htmlFor="problem" className="text-sm font-medium text-neutral-600">
        {t('floor.problem')}
      </label>
      {!isGeneral && quickProblems.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {quickProblems.map((item) => (
            <Chip key={item.id} active={false} onClick={() => onChange(item.label)}>
              {item.label}
            </Chip>
          ))}
        </div>
      )}
      <textarea
        id="problem"
        value={problem}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('floor.problemPlaceholder')}
        className="mt-2 min-h-24 w-full rounded-xl border border-neutral-300 bg-white p-4 text-base"
      />
    </section>
  );
}

function useReportForm(config: Config | undefined, onSent: (ref: string) => void) {
  const { t } = useTranslation();
  const report = useMutation({ mutationFn: raiseTicket });
  const [values, setValues] = useState<ReportValues>(EMPTY_REPORT);
  const isGeneral = values.kind === 'general';
  const valid = isGeneral
    ? Boolean(values.location.trim() && values.workType.trim() && values.problem.trim())
    : Boolean(values.machineId && values.problem.trim());
  const quickProblems = (config?.lists.quick_problem ?? []).filter((item) => item.active !== false);
  const error = report.error
    ? report.error instanceof ApiError
      ? report.error.message
      : t('floor.sendError')
    : null;

  function update(patch: Partial<ReportValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || report.isPending) return;
    const body: RaiseTicketBody = isGeneral
      ? {
          kind: values.kind,
          location: values.location.trim(),
          workType: values.workType.trim(),
          problem: values.problem.trim(),
        }
      : { kind: values.kind, machineId: values.machineId, problem: values.problem.trim() };
    report.mutate(body, { onSuccess: (result) => onSent(result.ticket.ref) });
  }

  return {
    values,
    update,
    isGeneral,
    valid,
    pending: report.isPending,
    error,
    quickProblems,
    submit,
  };
}

export function ReportForm({ config, onSent }: { config?: Config; onSent: (ref: string) => void }) {
  const { t } = useTranslation();
  const form = useReportForm(config, onSent);
  const { values } = form;
  return (
    <form onSubmit={form.submit} className="mt-4 space-y-6">
      <SituationPicker
        kind={values.kind}
        onChange={(kind) => form.update({ kind, machineId: '', location: '', workType: '' })}
      />
      {form.isGeneral ? (
        <GeneralFields values={values} update={form.update} />
      ) : (
        <MachinePicker
          machines={config?.machines ?? []}
          segments={config?.segments ?? []}
          groups={config?.groups ?? []}
          search={values.search}
          onSearch={(search) => form.update({ search })}
          segmentId={values.segmentId}
          onSegment={(id) => form.update({ segmentId: id, groupId: '', machineId: '' })}
          groupId={values.groupId}
          onGroup={(id) => form.update({ groupId: id, machineId: '' })}
          machineId={values.machineId}
          onMachine={(machineId) => form.update({ machineId })}
        />
      )}
      <ProblemField
        problem={values.problem}
        isGeneral={form.isGeneral}
        quickProblems={form.quickProblems}
        onChange={(problem) => form.update({ problem })}
      />
      {form.error && (
        <p role="alert" className="rounded-xl bg-stopped/10 p-4 text-stopped">
          {form.error}
        </p>
      )}
      <button
        type="submit"
        disabled={!form.valid || form.pending}
        className="min-h-14 w-full rounded-xl bg-accent px-4 text-lg font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
      >
        {form.pending ? t('common.sending') : t('common.send')}
      </button>
    </form>
  );
}
