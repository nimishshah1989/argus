/* eslint-disable i18next/no-literal-string -- sort keys, entity kinds and typed unions only; every visible word comes from the model */
import { useContext, type ReactNode } from 'react';
import { Button } from '../../../ui/v2/button.js';
import { DataTable, type Column, type FilterChip } from '../../../ui/v2/data-table.js';
import { EntityChip, EntityOpenContext } from '../../../ui/v2/entity-chip.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import type { PmCalendarModel, PmCalendarWords, PmJob } from './model.js';

/** A control inside a table row: pressing it must not also open the row's machine. */
function Own({ children }: { children: ReactNode }) {
  return <span onClick={(e) => e.stopPropagation()}>{children}</span>;
}

const machineColumn = (label: string): Column<PmJob> => ({
  key: 'machine',
  label,
  sortBy: (r) => r.machine.label,
  cell: (r) => <EntityChip {...r.machine} />,
});

/** The Move to date button, named for its machine so a screen reader can tell the rows apart. */
function MoveDate({
  job,
  label,
  onChoose,
}: {
  job: PmJob;
  label: string;
  onChoose: (job: PmJob) => void;
}) {
  return (
    <Own>
      <span data-job-button={job.machine.label}>
        <Button onClick={() => onChoose(job)}>
          {label}
          <span className="v2-sr">{job.machine.label}</span>
        </Button>
      </span>
    </Own>
  );
}

function SpreadAction({
  job,
  words,
  canMove,
  busy,
  onMove,
}: {
  job: PmJob;
  words: PmCalendarWords['spread'];
  canMove: boolean;
  /** A move is on its way: the button waits, as v1's did, so two quick presses are never two moves. */
  busy: boolean;
  onMove: (job: PmJob, day: string) => void;
}) {
  const free = job.suggested;
  if (free === null) return <span className="v2-sub">{words.noFreeDay}</span>;
  if (!canMove || !job.movable) return <span className="v2-sub">{free.text}</span>;
  return (
    <Own>
      <Button disabled={busy} onClick={() => onMove(job, free.iso)}>
        {free.moveLabel}
      </Button>
    </Own>
  );
}

/**
 * The crowded days and each one's nearest free working day, with the Move button the server would accept (a head or
 * an admin); everyone else reads the day in words. Shown only when a day is crowded.
 */
export function SpreadTable({
  model,
  busy = false,
  onMove,
}: {
  model: PmCalendarModel;
  busy?: boolean;
  onMove: (job: PmJob, day: string) => void;
}) {
  const open = useContext(EntityOpenContext);
  const words = model.words.spread;
  if (model.spread.length === 0) return null;
  const columns: Column<PmJob>[] = [
    machineColumn(words.columns.machine),
    {
      key: 'planned',
      label: words.columns.planned,
      sortBy: (r) => r.planned.value,
      cell: (r) => r.planned.shown,
    },
    {
      key: 'free',
      label: words.columns.free,
      sortBy: (r) => r.suggested?.value ?? 0,
      cell: (r) => (
        <SpreadAction job={r} words={words} canMove={model.canMove} busy={busy} onMove={onMove} />
      ),
    },
  ];
  return (
    <>
      <p className="v2-sub">{model.spreadSub}</p>
      <DataTable
        rows={model.spread}
        rowKey={(r) => r.machine.label}
        columns={columns}
        filters={[]}
        text={(r) => `${r.machine.label} ${r.planned.shown}`}
        words={words}
        initialSort={{ key: 'planned', dir: 'asc' }}
        onOpen={(r) => open(r.machine)}
      />
    </>
  );
}

function statusCell(job: PmJob, words: PmCalendarWords['legend']) {
  return (
    <div className="v2-row v2-gap-6">
      <KeyPill
        text={job.statusWord}
        tone={job.status === 'open' ? 'neutral' : 'plan'}
        icon={job.status === 'open' ? 'clock' : 'check'}
      />
      {job.crowded ? <KeyPill text={words.crowded} tone="risk" icon="alert" /> : null}
    </div>
  );
}

function jobColumns(model: PmCalendarModel, onChoose: (job: PmJob) => void): Column<PmJob>[] {
  const c = model.words.jobs.columns;
  const columns: Column<PmJob>[] = [
    machineColumn(c.machine),
    { key: 'job', label: c.job, sortBy: (r) => r.title, cell: (r) => r.title },
    {
      key: 'planned',
      label: c.planned,
      sortBy: (r) => r.planned.value,
      cell: (r) => r.planned.shown,
    },
    { key: 'due', label: c.due, sortBy: (r) => r.due.value, cell: (r) => r.due.shown },
    {
      key: 'tolerance',
      label: c.tolerance,
      numeric: true,
      sortBy: (r) => r.tolerance.value,
      cell: (r) => r.tolerance.shown,
    },
    {
      key: 'status',
      label: c.status,
      sortBy: (r) => `${r.status}${r.crowded ? '!' : ''}`,
      cell: (r) => statusCell(r, model.words.legend),
    },
  ];
  if (model.canMove)
    columns.push({
      key: 'move',
      label: c.action,
      cell: (r) =>
        r.movable ? (
          <MoveDate job={r} label={model.words.jobs.moveDate} onChoose={onChoose} />
        ) : null,
    });
  return columns;
}

/**
 * Every PM job of the shown month, with its plan and tolerance. A head or an admin gets "Move to date" on each job
 * that can still move: the keyboard way to do what a drag does, which has no keyboard.
 */
export function JobsTable({
  model,
  onChoose,
}: {
  model: PmCalendarModel;
  onChoose: (job: PmJob) => void;
}) {
  const open = useContext(EntityOpenContext);
  const words = model.words.jobs;
  const filters: FilterChip<PmJob>[] = [
    { key: 'all', label: words.filters.all },
    { key: 'crowded', label: words.filters.crowded, test: (r) => r.crowded },
    { key: 'open', label: words.filters.open, test: (r) => r.status === 'open' },
    { key: 'planned', label: words.filters.planned, test: (r) => r.status === 'planned' },
  ];
  return (
    <>
      <p className="v2-sub">{words.sub}</p>
      <DataTable
        rows={model.monthJobs}
        rowKey={(r) => r.machine.label}
        columns={jobColumns(model, onChoose)}
        filters={filters}
        text={(r) => `${r.machine.label} ${r.title} ${r.planned.shown} ${r.statusWord}`}
        words={words}
        initialSort={{ key: 'planned', dir: 'asc' }}
        onOpen={(r) => open(r.machine)}
      />
    </>
  );
}
