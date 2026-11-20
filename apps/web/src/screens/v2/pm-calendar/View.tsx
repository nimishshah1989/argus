/* eslint-disable i18next/no-literal-string -- entity kinds, role names and typed unions only; every visible word comes from the model */
import { lazy, Suspense, useContext, useState } from 'react';
import type { CalendarRange } from '../../../ui/v2/domain/calendar-events.js';
import { DrillAction } from '../../../ui/v2/drill-action.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { EntityOpenContext } from '../../../ui/v2/entity-chip.js';
import { FigureTile } from '../../../ui/v2/figure-tile.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Segs } from '../../../ui/v2/points.js';
import { Row } from '../../../ui/v2/row.js';
import { Skeleton } from '../../../ui/v2/screen-states.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { MoveFailed } from './move.js';
import { MovePanel, useRestoreFocus } from './move-panel.js';
import type { Judged, PmCalendarModel, PmJob, PmMoveRequest } from './model.js';
import { JobsTable, SpreadTable } from './tables.js';

/** The calendar library is reached only through this `import()`: its chunk loads when a calendar is on screen. */
const MonthCalendar = lazy(() => import('../../../ui/v2/domain/month-calendar.js'));

/** What the last move said: the line of where it landed, or the reason it did not. */
type Note = { kind: 'moved' | 'refused'; text: string } | null;

function Notes({ note }: { note: Note }) {
  if (note === null) return <div role="status" />;
  const moved = note.kind === 'moved';
  return (
    <div role={moved ? 'status' : 'alert'}>
      <p>
        <Segs point={[{ text: note.text, tone: moved ? 'gain' : 'loss' }]} />
      </p>
    </div>
  );
}

function Legend({ model }: { model: PmCalendarModel }) {
  const w = model.words.legend;
  return (
    <ul aria-label={w.label} className="v2-row v2-gap-6">
      <li>
        <KeyPill text={w.planned} tone="plan" icon="check" />
      </li>
      <li>
        <KeyPill text={w.open} tone="neutral" icon="clock" />
      </li>
      <li>
        <KeyPill text={w.crowded} tone="risk" icon="alert" />
      </li>
    </ul>
  );
}

function JudgedPanel({ model }: { model: PmCalendarModel }) {
  const w = model.words.judged;
  const lines: Judged[] = model.judged;
  return (
    <Panel title={w.title} sub={w.sub}>
      {lines.length === 0 ? (
        <p className="v2-sub">{model.figures[0]?.sub}</p>
      ) : (
        lines.map((line) => (
          <div key={line.label} className="v2-detail-section">
            <h3 className="v2-detail-label">{`${line.label}: ${line.rate}`}</h3>
            <div className="v2-row v2-gap-6">
              {line.counts.map((c) => (
                <KeyPill key={c.id} text={c.text} tone={c.tone} />
              ))}
            </div>
          </div>
        ))
      )}
    </Panel>
  );
}

function CalendarPanel({
  model,
  loading,
  onRange,
  onDrop,
}: {
  model: PmCalendarModel;
  loading: boolean;
  onRange: (range: CalendarRange) => void;
  onDrop: (id: string, day: string) => Promise<void>;
}) {
  const open = useContext(EntityOpenContext);
  const w = model.words.calendar;
  return (
    <Panel title={w.title} sub={model.calendarSub} aside={<Legend model={model} />}>
      <div aria-busy={loading}>
        <Suspense fallback={<Skeleton blocks={2} />}>
          <MonthCalendar
            events={model.events}
            editable={model.canMove}
            initialDate={model.today}
            words={{ label: w.title, today: w.today }}
            onMove={onDrop}
            onRange={onRange}
            onOpen={(code) => open({ kind: 'machine', id: code })}
          />
        </Suspense>
        {model.jobs.length === 0 && !loading ? <p className="v2-sub">{w.empty}</p> : null}
      </div>
    </Panel>
  );
}

/** One move at a time: the drag and the keyboard form share this, and it says what happened once. */
function useMoves(model: PmCalendarModel, onMove: (r: PmMoveRequest) => Promise<string>) {
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  const run = async (job: PmJob, day: string): Promise<boolean> => {
    setNote(null);
    setBusy(true);
    try {
      const text = await onMove({
        ...job.handle,
        machineCode: job.machine.label,
        scheduledOn: day,
      });
      setNote({ kind: 'moved', text });
      return true;
    } catch (error) {
      const text = error instanceof MoveFailed ? error.message : model.words.move.refused;
      setNote({ kind: 'refused', text });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const drop = async (id: string, day: string): Promise<void> => {
    const job = model.jobs.find((j) => j.id === id);
    if (job === undefined || !(await run(job, day))) throw new Error('refused');
  };
  return { note, busy, run, drop, clear: () => setNote(null) };
}

/**
 * The PM calendar: how PM is doing and how many jobs share a day, the month with a drag to move a job, how the
 * compliance was judged, the crowded days with their nearest free day, and every job of the month with a keyboard
 * "Move to date". A machine chip opens it in the drawer, which lives in the URL.
 */
export function PmCalendarView({
  model,
  loading,
  nav,
  title,
  onRange,
  onMove,
}: {
  model: PmCalendarModel;
  loading: boolean;
  nav: NavItem[];
  title: string;
  onRange: (range: CalendarRange) => void;
  onMove: (request: PmMoveRequest) => Promise<string>;
}) {
  const [chosen, setChosen] = useState<PmJob | null>(null);
  const remember = useRestoreFocus(chosen);
  const { note, busy, run, drop, clear } = useMoves(model, onMove);
  const choose = (job: PmJob): void => {
    remember(job);
    clear();
    setChosen(job);
  };
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      <Row cols={4}>
        {model.figures.map((figure) => (
          <FigureTile key={figure.id} figure={figure} />
        ))}
      </Row>
      {model.drill ? <DrillAction drill={model.drill} /> : null}
      <Notes note={chosen && note?.kind === 'refused' ? null : note} />
      <CalendarPanel model={model} loading={loading} onRange={onRange} onDrop={drop} />
      <JudgedPanel model={model} />
      <SpreadTable model={model} onMove={(job, day) => void run(job, day)} />
      {chosen && model.canMove ? (
        <MovePanel
          job={chosen}
          words={model.words.move}
          busy={busy}
          refusal={note?.kind === 'refused' ? note.text : null}
          onMove={async (job, day) => {
            const landed = await run(job, day);
            if (landed) setChosen(null);
            return landed;
          }}
          onClose={() => setChosen(null)}
        />
      ) : null}
      <JobsTable model={model} onChoose={choose} />
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
