/* eslint-disable i18next/no-literal-string -- Disposable English-only design review. */
import { useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  CircleStop,
  Factory,
  Inbox,
  LifeBuoy,
  MapPin,
  RotateCcw,
  Send,
} from 'lucide-react';
import { Button, Card, Field, IconLabel, StatusPair } from './components.js';
import {
  previewMachines,
  previewPeople,
  previewProblems,
  previewTickets,
  type PreviewMachine,
  type PreviewSituation,
} from './data.js';

function StepHeading({ number, title }: { number: number; title: string }) {
  return (
    <h2 className="preview-step-heading">
      <span aria-hidden="true">{number}</span>
      {title}
    </h2>
  );
}

interface MachineStepProps {
  query: string;
  machine?: PreviewMachine;
  matches: PreviewMachine[];
  onQuery: (value: string) => void;
  onSelect: (machine: PreviewMachine) => void;
  onChange: () => void;
}

function MachineStep({ query, machine, matches, onQuery, onSelect, onChange }: MachineStepProps) {
  return (
    <Card className="preview-step">
      <StepHeading number={1} title="Choose a machine" />
      {machine ? (
        <div className="preview-selected-machine">
          <Factory aria-hidden="true" size={24} strokeWidth={1.7} />
          <div>
            <strong>{machine.code}</strong>
            <p>{machine.name}</p>
            <IconLabel icon={MapPin}>{machine.location}</IconLabel>
          </div>
          <Button onClick={onChange} variant="quiet">
            Change
          </Button>
        </div>
      ) : (
        <>
          <Field id="machine-search" label="Search machines" hint="Search by code or machine name.">
            <input
              aria-describedby="machine-search-hint"
              autoComplete="off"
              id="machine-search"
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Try VC-17"
              type="search"
              value={query}
            />
          </Field>
          {query.trim() ? (
            <ul className="preview-machine-results" aria-label="Matching machines">
              {matches.map((match) => (
                <li key={match.id}>
                  <Button icon={Factory} onClick={() => onSelect(match)} variant="quiet">
                    {`${match.code} — ${match.name} · ${match.location}`}
                  </Button>
                </li>
              ))}
              {matches.length === 0 ? <li>No synthetic machines match that search.</li> : null}
            </ul>
          ) : null}
        </>
      )}
    </Card>
  );
}

interface SituationStepProps {
  value: PreviewSituation | null;
  onChange: (value: PreviewSituation) => void;
}

function SituationStep({ value, onChange }: SituationStepProps) {
  return (
    <Card className="preview-step">
      <StepHeading number={2} title="What is happening?" />
      <div className="preview-choice-grid">
        <Button
          aria-pressed={value === 'Stopped'}
          className="preview-choice preview-choice--stopped"
          icon={CircleStop}
          onClick={() => onChange('Stopped')}
          variant="quiet"
        >
          Stopped
        </Button>
        <Button
          aria-pressed={value === 'Support'}
          className="preview-choice preview-choice--support"
          icon={LifeBuoy}
          onClick={() => onChange('Support')}
          variant="quiet"
        >
          Support
        </Button>
      </div>
    </Card>
  );
}

interface ProblemStepProps {
  problem: string;
  onProblem: (value: string) => void;
}

function ProblemStep({ problem, onProblem }: ProblemStepProps) {
  return (
    <Card className="preview-step">
      <StepHeading number={3} title="Describe the problem" />
      <div className="preview-quick-problems" aria-label="Quick-select a problem">
        {previewProblems.map((item) => (
          <Button key={item} onClick={() => onProblem(item)} variant="quiet">
            {item}
          </Button>
        ))}
      </div>
      <Field id="problem" label="What is wrong?">
        <textarea
          id="problem"
          onChange={(event) => onProblem(event.target.value)}
          placeholder="Add a short, useful description"
          rows={4}
          value={problem}
        />
      </Field>
      <Button
        className="preview-primary-action"
        disabled={!problem.trim()}
        icon={Send}
        type="submit"
        variant="primary"
      >
        Send
      </Button>
    </Card>
  );
}

interface SentConfirmationProps {
  machine: PreviewMachine;
  problem: string;
  onReset: () => void;
}

function SentConfirmation({ machine, problem, onReset }: SentConfirmationProps) {
  return (
    <Card className="preview-confirmation">
      <div role="status">
        <CheckCircle2 className="preview-success-icon" aria-hidden="true" size={36} />
        <p className="preview-eyebrow">REPORTED</p>
        <h2>BD-0150</h2>
        <dl className="preview-confirmation-facts">
          <div>
            <dt>Machine</dt>
            <dd>{machine.code}</dd>
          </div>
          <div>
            <dt>Problem</dt>
            <dd>{problem}</dd>
          </div>
        </dl>
        <p className="preview-muted">This confirmation is fake. Nothing was sent or saved.</p>
        <Button icon={RotateCcw} onClick={onReset} variant="primary">
          Report another
        </Button>
      </div>
    </Card>
  );
}

interface MyComplaintsProps {
  actingPerson: string;
  onPerson: (id: string) => void;
}

function MyComplaints({ actingPerson, onPerson }: MyComplaintsProps) {
  const complaints = previewTickets.filter((ticket) => ticket.reportedBy === actingPerson);
  return (
    <Card className="preview-complaints">
      <Field id="acting-person" label="Acting person">
        <select
          id="acting-person"
          onChange={(event) => onPerson(event.target.value)}
          value={actingPerson}
        >
          {previewPeople.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </Field>
      <details className="preview-disclosure">
        <summary>
          <Inbox aria-hidden="true" size={19} />
          My complaints
          <span className="preview-count">{complaints.length}</span>
          <ChevronDown aria-hidden="true" size={18} />
        </summary>
        <div className="preview-disclosure-body">
          {complaints.map((ticket) => (
            <div className="preview-complaint" key={ticket.ref}>
              <div>
                <strong>{ticket.ref}</strong>
                <span>{ticket.machineCode}</span>
              </div>
              <p>{ticket.problem}</p>
              <StatusPair condition={ticket.condition} work={ticket.work} />
            </div>
          ))}
          {complaints.length === 0 ? <p>No reports for this synthetic person.</p> : null}
        </div>
      </details>
    </Card>
  );
}

export function FloorPreview() {
  const [query, setQuery] = useState('');
  const [machine, setMachine] = useState<PreviewMachine>();
  const [situation, setSituation] = useState<PreviewSituation | null>(null);
  const [problem, setProblem] = useState('');
  const [actingPerson, setActingPerson] = useState('avery');
  const [sent, setSent] = useState(false);
  const matches = previewMachines.filter((item) =>
    `${item.code} ${item.name}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function selectMachine(selected: PreviewMachine) {
    setMachine(selected);
    setQuery(selected.code);
    setSituation(null);
    setProblem('');
  }

  function resetReport() {
    setMachine(undefined);
    setQuery('');
    setSituation(null);
    setProblem('');
    setSent(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (machine && situation && problem.trim()) setSent(true);
  }

  return (
    <div className="preview-floor">
      <form onSubmit={submit}>
        {sent && machine && situation ? (
          <SentConfirmation machine={machine} problem={problem} onReset={resetReport} />
        ) : (
          <>
            <MachineStep
              query={query}
              machine={machine}
              matches={matches}
              onQuery={setQuery}
              onSelect={selectMachine}
              onChange={resetReport}
            />
            {machine ? <SituationStep value={situation} onChange={setSituation} /> : null}
            {machine && situation ? <ProblemStep problem={problem} onProblem={setProblem} /> : null}
          </>
        )}
      </form>
      <MyComplaints actingPerson={actingPerson} onPerson={setActingPerson} />
    </div>
  );
}
