import type { ReactNode } from 'react';
import type {
  BreakdownCategory,
  BreakdownReportBody,
  Config,
  Person,
  Shift,
  Ticket,
} from '../api.js';

const inputClass =
  'mt-2 min-h-13 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base';
const labelClass = 'text-sm font-medium text-neutral-600';

export interface ReportValues {
  problem: string;
  observedBy: string;
  correctiveAction: string;
  doneByPersonIds: string[];
  supportedByPersonIds: string[];
  downtimeMin: string;
  responseMin: string;
  repairMin: string;
  breakdownCategory: string;
  maintCode: string;
  spareUsed: string;
  rootCause: string;
  handoverName: string;
  date: string;
  shiftCode: string;
}

function minutesText(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

export function tenantToday(timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

function clockMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}

/** The shift whose window contains the tenant-local time now, if the plant has shifts. */
export function currentShiftCode(shifts: Shift[], timeZone?: string): string {
  if (shifts.length === 0) return '';
  const now = clockMinutes(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(new Date()),
  );
  const shift = shifts.find((item) => {
    const start = clockMinutes(item.starts_at);
    const end = clockMinutes(item.ends_at);
    return item.crosses_midnight ? now >= start || now < end : now >= start && now < end;
  });
  return shift?.code ?? '';
}

export function initialReportValues(ticket: Ticket, config: Config): ReportValues {
  const figures = ticket.figures;
  return {
    problem: ticket.problem,
    observedBy: '',
    correctiveAction: '',
    doneByPersonIds: ticket.leadPersonId ? [ticket.leadPersonId] : [],
    supportedByPersonIds: [],
    downtimeMin: minutesText(figures?.downtimeMin ?? figures?.downAccMin),
    responseMin: minutesText(figures?.responseMin),
    repairMin: minutesText(figures?.repairMin),
    breakdownCategory: '',
    maintCode: '',
    spareUsed: '',
    rootCause: '',
    handoverName: '',
    date: tenantToday(config.timeZone),
    shiftCode: currentShiftCode(config.shifts, config.timeZone),
  };
}

function text(value: string): string | undefined {
  return value.trim() || undefined;
}

function selected(ids: string[]): string[] | undefined {
  return ids.length > 0 ? ids : undefined;
}

function minutes(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : undefined;
}

function category(value: string): BreakdownCategory | undefined {
  return value === 'E' || value === 'M' || value === 'E/M' || value === 'PM' ? value : undefined;
}

export function buildReportBody(values: ReportValues): BreakdownReportBody {
  return {
    problem: text(values.problem),
    observedBy: text(values.observedBy),
    correctiveAction: text(values.correctiveAction),
    doneByPersonIds: selected(values.doneByPersonIds),
    supportedByPersonIds: selected(values.supportedByPersonIds),
    downtimeMin: minutes(values.downtimeMin),
    responseMin: minutes(values.responseMin),
    repairMin: minutes(values.repairMin),
    breakdownCategory: category(values.breakdownCategory),
    maintCode: text(values.maintCode),
    spareUsed: text(values.spareUsed),
    rootCause: text(values.rootCause),
    handoverName: text(values.handoverName),
    date: text(values.date),
    shiftCode: text(values.shiftCode),
  };
}

export interface ReportValuesProps {
  values: ReportValues;
  update: (patch: Partial<ReportValues>) => void;
}

export function togglePerson(ids: string[], personId: string): string[] {
  return ids.includes(personId) ? ids.filter((item) => item !== personId) : [...ids, personId];
}

export function listOptions(config: Config, list: string): { value: string; label: string }[] {
  return (config.lists[list] ?? [])
    .filter((item) => item.active !== false)
    .map((item) => ({ value: item.code, label: item.label }));
}

export function shiftOptions(shifts: Shift[]): { value: string; label: string }[] {
  return shifts.map((shift) => ({ value: shift.code, label: shift.name }));
}

export function activePeople(people: Person[]): Person[] {
  return people.filter((person) => person.active !== false);
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className={labelClass}>{title}</h3>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'date';
  multiline?: boolean;
  placeholder?: string;
}

export function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  multiline = false,
  placeholder,
}: FieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className={labelClass}>{label}</span>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`${inputClass} min-h-24 py-3`}
        />
      ) : (
        <input
          id={id}
          type={type}
          min={type === 'number' ? 0 : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
    </label>
  );
}

interface SelectProps {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function SelectField({ id, label, value, options, onChange }: SelectProps) {
  return (
    <label htmlFor={id} className="block">
      <span className={labelClass}>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        <option value="">Choose…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FillReport({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">Breakdown report</h2>
      <p className="mt-2 text-sm text-neutral-600">
        This ticket was closed without a report. File it now to complete the record.
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 min-h-13 w-full rounded-xl bg-accent px-4 text-base font-semibold text-white hover:bg-accent/90"
      >
        Fill report
      </button>
    </section>
  );
}

export function ContextSection({ values, update, config }: ReportValuesProps & { config: Config }) {
  return (
    <Section title="When">
      <Field
        id="report-date"
        label="Date"
        value={values.date}
        onChange={(date) => update({ date })}
        type="date"
      />
      <SelectField
        id="report-shift"
        label="Shift"
        value={values.shiftCode}
        options={shiftOptions(config.shifts)}
        onChange={(shiftCode) => update({ shiftCode })}
      />
    </Section>
  );
}

interface PeoplePickerProps {
  legend: string;
  people: Person[];
  selected: string[];
  onToggle: (personId: string) => void;
}

export function PeoplePicker({ legend, people, selected, onToggle }: PeoplePickerProps) {
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <div className="mt-2 grid gap-1">
        {people.map((person) => (
          <label
            key={person.id}
            className="flex min-h-13 items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4"
          >
            <input
              type="checkbox"
              checked={selected.includes(person.id)}
              onChange={() => onToggle(person.id)}
              className="h-5 w-5 accent-accent"
            />
            <span className="text-base">{person.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
