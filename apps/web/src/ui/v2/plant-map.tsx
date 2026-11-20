import { useState } from 'react';
import { Pause, TriangleAlert, Wrench, X } from '../icon.js';
import { Panel } from './panel.js';
import { Points, type Point } from './points.js';
import { Segmented } from './segmented.js';

export type MachineState = 'run' | 'risk' | 'down' | 'pm' | 'idle';
export type MachineData = { code: string; state: MachineState; why: Point[] };
export type CellData = { name: string; machines: MachineData[] };
export type PlantFilter = 'all' | 'down' | 'risk' | 'pm';

export type PlantWords = {
  title: string;
  filterLabel: string;
  filters: Record<PlantFilter, string>;
  states: Record<MachineState, string>;
  hint: string;
  /** `{n}` is replaced by the count. */
  cellDown: string;
  cellRunning: string;
};

const STATES: MachineState[] = ['run', 'risk', 'down', 'pm', 'idle'];
const FILTERS: PlantFilter[] = ['all', 'down', 'risk', 'pm'];
/** A glyph on every state but running, so colour is never the only sign. */
const GLYPH = { run: null, risk: TriangleAlert, down: X, pm: Wrench, idle: Pause };

function Glyph({ state }: { state: MachineState }) {
  const Icon = GLYPH[state];
  return Icon ? <Icon size={12} strokeWidth={3} aria-hidden="true" /> : null;
}

type Pick = { picked: MachineData | null; onPick: (m: MachineData) => void };

function CellRow({
  cell,
  words,
  filter,
  picked,
  onPick,
}: { cell: CellData; words: PlantWords; filter: PlantFilter } & Pick) {
  const down = cell.machines.filter((m) => m.state === 'down').length;
  const note = down ? words.cellDown.replace('{n}', String(down)) : words.cellRunning;
  return (
    <div className="v2-cell">
      <span className="v2-cell-name">{cell.name}</span>
      <div className="v2-tiles">
        {cell.machines.map((m) => {
          const name = `${m.code}, ${cell.name}: ${words.states[m.state]}`;
          return (
            <button
              key={m.code}
              type="button"
              className="v2-tile"
              data-state={m.state}
              data-dim={filter !== 'all' && filter !== m.state}
              aria-pressed={picked === m}
              aria-label={name}
              title={name}
              onClick={() => onPick(m)}
            >
              <Glyph state={m.state} />
            </button>
          );
        })}
      </div>
      <span className={down ? 'v2-cell-note v2-seg-loss' : 'v2-cell-note'}>{note}</span>
    </div>
  );
}

function Picked({ picked, words }: { picked: MachineData | null; words: PlantWords }) {
  if (!picked) return <span className="v2-note">{words.hint}</span>;
  return (
    <div className="v2-open v2-well v2-stack v2-gap-6">
      <div className="v2-row v2-gap-8">
        <span className="v2-code">{picked.code}</span>
        <span className="v2-tile-chip" data-state={picked.state}>
          <Glyph state={picked.state} />
          {words.states[picked.state]}
        </span>
      </div>
      <Points points={picked.why} />
    </div>
  );
}

/** Every machine as a square in its cell's row; a filter dims the rest; a tap opens that machine's why. */
export function PlantMap({ cells, words }: { cells: CellData[]; words: PlantWords }) {
  const [filter, setFilter] = useState<PlantFilter>('all');
  const [picked, setPicked] = useState<MachineData | null>(null);
  const onPick = (m: MachineData) => setPicked(picked === m ? null : m);
  const tally = (s: MachineState) =>
    cells.reduce((n, c) => n + c.machines.filter((m) => m.state === s).length, 0);
  const filters = FILTERS.map((key) => ({ key, label: words.filters[key] }));
  const aside = (
    <Segmented label={words.filterLabel} options={filters} value={filter} onChange={setFilter} />
  );
  return (
    <Panel id="v2-plant" title={words.title} aside={aside}>
      {cells.map((cell) => (
        <CellRow key={cell.name} {...{ cell, words, filter, picked, onPick }} />
      ))}
      <div aria-live="polite">
        <Picked picked={picked} words={words} />
      </div>
      <div className="v2-legend">
        {STATES.map((s) => (
          <span key={s} className="v2-row v2-gap-6">
            <span className="v2-tile v2-swatch" data-state={s} aria-hidden="true">
              <Glyph state={s} />
            </span>
            {words.states[s]} <b className="v2-num">{tally(s)}</b>
          </span>
        ))}
      </div>
    </Panel>
  );
}
