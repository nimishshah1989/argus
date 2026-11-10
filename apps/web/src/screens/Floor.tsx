import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, getConfig, raiseTicket, type RaiseKind } from '../api.js';
import { Chip } from './floor/Chip.js';
import { MachinePicker } from './floor/MachinePicker.js';

const SITUATIONS: { kind: RaiseKind; label: string }[] = [
  { kind: 'stopped', label: 'Stopped' },
  { kind: 'support', label: 'Support' },
  { kind: 'general', label: 'Work request' },
];

const inputClass = 'min-h-13 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base';

export function Floor() {
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const report = useMutation({ mutationFn: raiseTicket });

  const [search, setSearch] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [kind, setKind] = useState<RaiseKind>('stopped');
  const [location, setLocation] = useState('');
  const [workType, setWorkType] = useState('');
  const [problem, setProblem] = useState('');
  const [sentRef, setSentRef] = useState('');

  const cfg = config.data;
  const quickProblems = (cfg?.lists.quick_problem ?? []).filter((item) => item.active !== false);
  const isGeneral = kind === 'general';
  const valid = isGeneral
    ? Boolean(location.trim() && workType.trim() && problem.trim())
    : Boolean(machineId && problem.trim());
  const errorMessage = report.error
    ? report.error instanceof ApiError
      ? report.error.message
      : 'Could not send, try again'
    : null;

  function selectSegment(id: string) {
    setSegmentId(id);
    setGroupId('');
    setMachineId('');
  }

  function selectGroup(id: string) {
    setGroupId(id);
    setMachineId('');
  }

  function selectKind(next: RaiseKind) {
    setKind(next);
    setMachineId('');
    setLocation('');
    setWorkType('');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || report.isPending) return;
    report.mutate(
      isGeneral
        ? { kind, location: location.trim(), workType: workType.trim(), problem: problem.trim() }
        : { kind, machineId, problem: problem.trim() },
      {
        onSuccess: (result) => {
          setSentRef(result.ticket.ref);
          setSearch('');
          setSegmentId('');
          setGroupId('');
          setMachineId('');
          setLocation('');
          setWorkType('');
          setProblem('');
        },
      },
    );
  }

  if (sentRef) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-6">
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Reported</h1>
          <p className="mt-2 text-neutral-600">Maintenance has been notified.</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-accent">{sentRef}</p>
          <button
            type="button"
            onClick={() => setSentRef('')}
            className="mt-6 min-h-13 w-full rounded-xl bg-accent px-4 text-lg font-semibold text-white hover:bg-accent/90"
          >
            Report another
          </button>
          <Link to="/desk" className="mt-3 inline-block text-accent">
            View open tickets
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <nav className="mb-6 flex gap-2">
        <Link
          to="/floor"
          className="rounded-lg bg-neutral-200 px-4 py-2 font-medium text-neutral-900"
        >
          Report
        </Link>
        <Link
          to="/desk"
          className="rounded-lg px-4 py-2 font-medium text-neutral-600 hover:bg-neutral-200"
        >
          Open
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold">Report a problem</h1>

      <form onSubmit={submit} className="mt-4 space-y-6">
        <section>
          <h2 className="text-sm font-medium text-neutral-600">What is happening?</h2>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {SITUATIONS.map((situation) => {
              const selected = kind === situation.kind;
              return (
                <button
                  key={situation.kind}
                  type="button"
                  onClick={() => selectKind(situation.kind)}
                  aria-pressed={selected}
                  className={`min-h-13 rounded-xl border px-2 text-base font-medium ${
                    selected
                      ? 'border-accent bg-accent text-white'
                      : 'border-neutral-300 bg-white text-neutral-800'
                  }`}
                >
                  {situation.label}
                </button>
              );
            })}
          </div>
        </section>

        {isGeneral ? (
          <section className="space-y-4">
            <div>
              <label htmlFor="location" className="text-sm font-medium text-neutral-600">
                Where?
              </label>
              <input
                id="location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Machine area or cell"
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label htmlFor="workType" className="text-sm font-medium text-neutral-600">
                What kind of work?
              </label>
              <input
                id="workType"
                value={workType}
                onChange={(event) => setWorkType(event.target.value)}
                placeholder="e.g. Clean, move, repair"
                className={`mt-2 ${inputClass}`}
              />
            </div>
          </section>
        ) : (
          <MachinePicker
            machines={cfg?.machines ?? []}
            segments={cfg?.segments ?? []}
            groups={cfg?.groups ?? []}
            search={search}
            onSearch={setSearch}
            segmentId={segmentId}
            onSegment={selectSegment}
            groupId={groupId}
            onGroup={selectGroup}
            machineId={machineId}
            onMachine={setMachineId}
          />
        )}

        <section>
          <label htmlFor="problem" className="text-sm font-medium text-neutral-600">
            What is wrong?
          </label>
          {!isGeneral && quickProblems.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {quickProblems.map((item) => (
                <Chip key={item.id} active={false} onClick={() => setProblem(item.label)}>
                  {item.label}
                </Chip>
              ))}
            </div>
          )}
          <textarea
            id="problem"
            value={problem}
            onChange={(event) => setProblem(event.target.value)}
            placeholder="Describe the problem"
            className="mt-2 min-h-24 w-full rounded-xl border border-neutral-300 bg-white p-4 text-base"
          />
        </section>

        {errorMessage && (
          <p role="alert" className="rounded-xl bg-stopped/10 p-4 text-stopped">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={!valid || report.isPending}
          className="min-h-14 w-full rounded-xl bg-accent px-4 text-lg font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {report.isPending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </main>
  );
}
