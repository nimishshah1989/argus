import { useRef, useState, type KeyboardEvent } from 'react';
import { Pause, TriangleAlert, Wrench, X } from '../../icon.js';
import { Panel } from '../panel.js';
import { Points } from '../points.js';
import { Segmented } from '../segmented.js';
import {
  cellNote,
  nextTile,
  type CellData,
  type MachineData,
  type MachineState,
  type PlantFilter,
  type PlantWords,
} from './plant.js';

const STATES: MachineState[] = ['run', 'risk', 'down', 'pm', 'idle'];
const FILTERS: PlantFilter[] = ['all', 'down', 'risk', 'pm'];
/** A glyph on every state but running, so colour is never the only sign. */
const GLYPH = { run: null, risk: TriangleAlert, down: X, pm: Wrench, idle: Pause };

function Glyph({ state }: { state: MachineState }) {
  const Icon = GLYPH[state];
  return Icon ? <Icon size={12} strokeWidth={3} aria-hidden="true" /> : null;
}

type Tiles = {
  shown: (m: MachineData) => boolean;
  picked: string | null;
  focus: string | undefined;
  onPick: (code: string) => void;
  /** A tile that takes focus, by click or by Tab, becomes where the arrow keys start. */
  onFocus: (code: string) => void;
};

function CellRow({ cell, words, t }: { cell: CellData; words: PlantWords; t: Tiles }) {
  const down = cell.machines.some((m) => m.state === 'down');
  const note = cellNote(cell, words);
  return (
    <div className="v2-cell">
      <span className="v2-cell-name">{cell.name}</span>
      <div className="v2-tiles">
        {cell.machines.map((m) => (
          <button
            key={m.code}
            type="button"
            className="v2-tile"
            data-code={m.code}
            data-state={m.state}
            disabled={!t.shown(m)}
            tabIndex={m.code === t.focus ? 0 : -1}
            aria-pressed={t.picked === m.code}
            aria-label={`${m.code}, ${cell.name}: ${words.states[m.state]}`}
            onClick={() => t.onPick(m.code)}
            onFocus={() => t.onFocus(m.code)}
          >
            <Glyph state={m.state} />
          </button>
        ))}
      </div>
      <span className={down ? 'v2-cell-note v2-seg-loss' : 'v2-cell-note'}>{note}</span>
    </div>
  );
}

function Picked({ machine, words }: { machine: MachineData | undefined; words: PlantWords }) {
  if (!machine) return <span className="v2-note">{words.hint}</span>;
  return (
    <div className="v2-open v2-well v2-stack v2-gap-6">
      <div className="v2-row v2-gap-8">
        <span className="v2-code">{machine.code}</span>
        <span className="v2-tile-chip" data-state={machine.state}>
          <Glyph state={machine.state} />
          {words.states[machine.state]}
        </span>
      </div>
      <Points points={machine.why} />
    </div>
  );
}

/** Every machine as a square in its cell's row: one tab stop, arrow keys inside, a filter, a tap opens its why. */
export function PlantMap({ cells, words }: { cells: CellData[]; words: PlantWords }) {
  const [filter, setFilter] = useState<PlantFilter>('all');
  const [picked, setPicked] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const map = useRef<HTMLDivElement>(null);
  const shown = (m: MachineData) => filter === 'all' || filter === m.state;
  const rows = cells.map((c) => c.machines.filter(shown).map((m) => m.code));
  const focus = active && rows.some((r) => r.includes(active)) ? active : rows.flat()[0];
  const onKeyDown = (e: KeyboardEvent) => {
    const to = focus && nextTile(rows, focus, e.key);
    if (!to) return;
    e.preventDefault();
    setActive(to);
    map.current?.querySelector<HTMLElement>(`[data-code="${CSS.escape(to)}"]`)?.focus();
  };
  const all = cells.flatMap((c) => c.machines);
  const t: Tiles = {
    shown,
    picked,
    focus,
    onPick: (code) => {
      setActive(code);
      setPicked(picked === code ? null : code);
    },
    onFocus: setActive,
  };
  const options = FILTERS.map((key) => ({ key, label: words.filters[key] }));
  const aside = (
    <Segmented label={words.filterLabel} options={options} value={filter} onChange={setFilter} />
  );
  return (
    <Panel title={words.title} aside={aside}>
      <div
        ref={map}
        role="group"
        aria-label={words.mapLabel}
        className="v2-map"
        onKeyDown={onKeyDown}
      >
        {cells.map((cell) => (
          <CellRow key={cell.name} cell={cell} words={words} t={t} />
        ))}
      </div>
      <div aria-live="polite">
        <Picked machine={all.find((m) => m.code === picked)} words={words} />
      </div>
      <div className="v2-legend">
        {STATES.map((s) => (
          <span key={s} className="v2-row v2-gap-6">
            <span className="v2-tile v2-swatch" data-state={s} aria-hidden="true">
              <Glyph state={s} />
            </span>
            {words.states[s]} <b className="v2-num">{all.filter((m) => m.state === s).length}</b>
          </span>
        ))}
      </div>
    </Panel>
  );
}
