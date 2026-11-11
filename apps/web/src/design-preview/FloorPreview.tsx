/* eslint-disable i18next/no-literal-string -- Disposable English-only design review. */
import { useState, type FormEvent } from 'react';
import { CheckCircle2, CircleStop, Factory, Inbox, LifeBuoy, RotateCcw, Send } from 'lucide-react';
import { Button, Card, Field, countStyle, fieldInput, mutedText } from './components.js';
import {
  previewMachines,
  previewPeople,
  previewProblems,
  previewTickets,
  type PreviewMachine,
  type PreviewSituation,
} from './data.js';

const ui = {
  heading: 'mb-[18px] flex items-center gap-2.5 text-lg font-semibold',
  choice: 'min-h-[64px] border-[var(--line)] bg-white',
  quick: 'bg-[var(--neutral)] text-sm',
  action: 'w-full sm:w-auto sm:min-w-[180px]',
};
const tones = {
  Stopped: 'border-[var(--red)] bg-[var(--red-soft)] text-[var(--red)]',
  Support: 'border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]',
};
function StepHeading({ number, title }: { number: number; title: string }) {
  return (
    <h2 className={ui.heading}>
      {number} · {title}
    </h2>
  );
}

interface MachineProps {
  machine?: PreviewMachine;
  onSelect: (machine: PreviewMachine) => void;
  onChange: () => void;
}
function MachineStep({ machine, onSelect, onChange }: MachineProps) {
  const [query, setQuery] = useState('');
  const matches = previewMachines.filter((item) =>
    `${item.code} ${item.name}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <Card>
      <StepHeading number={1} title="Choose a machine" />
      {machine ? (
        <div className="flex items-center gap-3.5">
          <p className="min-w-0 flex-1">
            <strong>{machine.code}</strong> · {machine.name} · {machine.location}
          </p>
          <Button onClick={onChange} variant="quiet">
            Change
          </Button>
        </div>
      ) : (
        <>
          <Field id="machine-search" label="Search machines">
            <input
              className={fieldInput}
              id="machine-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try VC-17"
              type="search"
            />
          </Field>
          {query.trim() ? (
            <div className="mt-3 grid gap-2">
              {matches.map((match) => (
                <Button
                  className="w-full justify-start text-left"
                  icon={Factory}
                  key={match.id}
                  onClick={() => onSelect(match)}
                >{`${match.code} — ${match.name} · ${match.location}`}</Button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function DetailsStep() {
  const [situation, setSituation] = useState<PreviewSituation | null>(null);
  const [problem, setProblem] = useState('');
  return (
    <>
      <Card>
        <StepHeading number={2} title="What is happening?" />
        <div className="grid grid-cols-2 gap-3">
          {(['Stopped', 'Support'] as const).map((option) => (
            <Button
              aria-pressed={situation === option}
              className={`${ui.choice} ${situation === option ? tones[option] : ''}`}
              icon={option === 'Stopped' ? CircleStop : LifeBuoy}
              key={option}
              onClick={() => setSituation(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      </Card>
      {situation ? (
        <Card>
          <StepHeading number={3} title="Describe the problem" />
          <div className="mb-4 flex flex-wrap gap-2" aria-label="Quick-select a problem">
            {previewProblems.map((item) => (
              <Button className={ui.quick} key={item} onClick={() => setProblem(item)}>
                {item}
              </Button>
            ))}
          </div>
          <Field id="problem" label="What is wrong?">
            <textarea
              className={`${fieldInput} min-h-[120px] resize-y`}
              id="problem"
              onChange={(event) => setProblem(event.target.value)}
              placeholder="Add a short, useful description"
              value={problem}
            />
          </Field>
          <Button
            className={ui.action}
            disabled={!problem.trim()}
            icon={Send}
            type="submit"
            variant="primary"
          >
            Send
          </Button>
        </Card>
      ) : null}
    </>
  );
}

interface ComplaintsProps {
  actingPerson: string;
  onPerson: (id: string) => void;
}
function MyComplaints({ actingPerson, onPerson }: ComplaintsProps) {
  const complaints = previewTickets.filter((ticket) => ticket.reportedBy === actingPerson);
  return (
    <Card className="mt-5 grid gap-4">
      <Field id="acting-person" label="Acting person">
        <select
          className={fieldInput}
          id="acting-person"
          onChange={(event) => onPerson(event.target.value)}
        >
          {previewPeople.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </Field>
      <section aria-label="My complaints">
        <h2 className={ui.heading}>
          <Inbox aria-hidden="true" size={19} />
          My complaints<span className={countStyle}>{complaints.length}</span>
        </h2>
        {complaints.map((ticket) => (
          <p
            className="border-t border-[var(--line)] py-3.5"
            key={ticket.ref}
          >{`${ticket.ref} · ${ticket.machineCode} — ${ticket.problem}`}</p>
        ))}
        {complaints.length === 0 ? (
          <p className={mutedText}>No reports for this synthetic person.</p>
        ) : null}
      </section>
    </Card>
  );
}

export function FloorPreview() {
  const [machine, setMachine] = useState<PreviewMachine>();
  const [actingPerson, setActingPerson] = useState('avery');
  const [sent, setSent] = useState(false);
  function resetReport() {
    setMachine(undefined);
    setSent(false);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (machine) setSent(true);
  }
  return (
    <div className="mx-auto max-w-[840px]">
      <form className="grid gap-4" onSubmit={submit}>
        {sent ? (
          <Card className="text-center">
            <div role="status">
              <CheckCircle2 className="mb-3 text-[var(--green)]" aria-hidden="true" size={36} />
              <h2 className="text-5xl font-semibold tracking-[-0.04em]">BD-0150</h2>
              <p className={`${mutedText} mb-5 mt-4`}>
                This confirmation is fake. Nothing was sent or saved.
              </p>
              <Button icon={RotateCcw} onClick={resetReport} variant="primary">
                Report another
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <MachineStep
              key={machine?.id ?? 'search'}
              machine={machine}
              onSelect={setMachine}
              onChange={resetReport}
            />
            {machine ? <DetailsStep /> : null}
          </>
        )}
      </form>
      <MyComplaints actingPerson={actingPerson} onPerson={setActingPerson} />
    </div>
  );
}
