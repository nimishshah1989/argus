/* eslint-disable i18next/no-literal-string -- entity kinds, role names and typed unions only; every visible word comes from the model */
import { lazy, Suspense, useContext, useState } from 'react';
import { DOC_REF } from '@uptimo/shared/doc-ref';
import type { CalendarRange } from '../../../ui/v2/domain/calendar-events.js';
import { DownloadExcel } from '../../../ui/v2/download-excel.js';
import { DrillAction } from '../../../ui/v2/drill-action.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { EntityOpenContext } from '../../../ui/v2/entity-chip.js';
import { FigureTile } from '../../../ui/v2/figure-tile.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Segs } from '../../../ui/v2/points.js';
import { Row } from '../../../ui/v2/row.js';
import { Skeleton } from '../../../ui/v2/screen-states.js';
import { ShowDetail } from '../../../ui/v2/show-detail.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { MoveFailed } from './move.js';
import { MovePanel, useRestoreFocus } from './move-panel.js';
import type { Judged, PmCalendarModel, PmJob, PmMoveRequest } from './model.js';
import { leave, settleMove } from './settle.js';
import { pmSheets } from './sweep.js';
import { JobsTable, SpreadTable } from './tables.js';

/** The calendar library is reached only through this `import()`: its chunk loads when a calendar is on screen. */
const MonthCalendar = lazy(() => import('../../../ui/v2/domain/month-calendar.js'));

/** What the last move said: the line of where it landed, or the reason it did not. */
type Note = { kind: 'moved' | 'refused'; text: string; job: string } | null;

/** A refusal that belongs to the form on screen: another job's refusal is said on the page, never inside this form. */
const ownRefusal = (note: Note, chosen: PmJob | null): boolean =>
  note?.kind === 'refused' && chosen !== null && note.job === chosen.id;

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
  busy,
  onRange,
  onDrop,
}: {
  model: PmCalendarModel;
  loading: boolean;
  /** A move is on its way: no second drag starts until it has landed, so two never carry one job's old ids. */
  busy: boolean;
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
            editable={model.canMove && !busy}
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
  // Moves in flight, counted: one that lands must not say "done" while another is still on its way.
  const [pending, setPending] = useState(0);
  const busy = pending > 0;
  const run = async (job: PmJob, day: string): Promise<boolean> => {
    setNote(null);
    setPending((n) => n + 1);
    try {
      const text = await onMove({
        ...job.handle,
        machineCode: job.machine.label,
        scheduledOn: day,
      });
      setNote({ kind: 'moved', text, job: job.id });
      return true;
    } catch (error) {
      const text = error instanceof MoveFailed ? error.message : model.words.move.refused;
      setNote({ kind: 'refused', text, job: job.id });
      return false;
    } finally {
      setPending((n) => n - 1);
    }
  };
  const drop = async (id: string, day: string): Promise<void> => {
    const job = model.jobs.find((j) => j.id === id);
    if (job === undefined || !(await run(job, day))) throw new Error('refused');
  };
  return { note, busy, run, drop, clear: () => setNote(null) };
}

/** The page's figures: the first four in a row, the rest under "Show detail". */
function Figures({ figures }: { figures: PmCalendarModel['figures'] }) {
  return (
    <>
      <Row cols={4}>
        {figures.slice(0, 4).map((figure) => (
          <FigureTile key={figure.id} figure={figure} />
        ))}
      </Row>
      {figures.length > 4 ? (
        <ShowDetail>
          <Row cols={4}>
            {figures.slice(4).map((figure) => (
              <FigureTile key={figure.id} figure={figure} />
            ))}
          </Row>
        </ShowDetail>
      ) : null}
    </>
  );
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
      <Figures figures={model.figures} />
      {model.drill ? <DrillAction drill={model.drill} /> : null}
      <Notes note={ownRefusal(note, chosen) ? null : note} />
      <CalendarPanel model={model} loading={loading} busy={busy} onRange={onRange} onDrop={drop} />
      <JudgedPanel model={model} />
      <SpreadTable model={model} busy={busy} onMove={(job, day) => void run(job, day)} />
      {chosen && model.canMove ? (
        <MovePanel
          // One form per job: its date field starts at that job's own day and takes the focus, never the last job's.
          key={chosen.id}
          job={chosen}
          words={model.words.move}
          busy={busy}
          refusal={ownRefusal(note, chosen) ? (note?.text ?? null) : null}
          onMove={(job, day) =>
            settleMove(run, job, day, (landed) => setChosen((now) => leave(now, landed)))
          }
          onClose={() => setChosen(null)}
        />
      ) : null}
      <div>
        <DownloadExcel file="pm-calendar" sheets={pmSheets(model)} docRef={DOC_REF.pm} />
      </div>
      <JobsTable model={model} onChoose={choose} />
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
