import { useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../icons.js';
import { Panel } from '../panel.js';
import { Segmented } from '../segmented.js';
import {
  cellNote,
  nextTile,
  STATE_ICON,
  type CellData,
  type MachineData,
  type MachineState,
  type PlantFilter,
  type PlantWords,
} from './plant.js';

const STATES: MachineState[] = ['run', 'risk', 'down', 'pm', 'idle'];
const FILTERS: PlantFilter[] = ['all', 'down', 'risk', 'pm'];
/** A glyph on every state but running, so colour is never the only sign. */
function Glyph({ state }: { state: MachineState }) {
  const name = STATE_ICON[state];
  return name ? <Icon name={name} size={12} /> : null;
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

/** The five states, each with its glyph and how many machines are in it now. */
function PlantLegend({ machines, words }: { machines: MachineData[]; words: PlantWords }) {
  const all = machines;
  return (
    <div className="v2-legend">
      {STATES.map((s) => (
        <span key={s} className="v2-row v2-gap-6">
          <span className="v2-tile v2-swatch" data-state={s} aria-hidden="true">
            <Glyph state={s} />
          </span>
          {words.states[s]}{' '}
          <span className="v2-num">{all.filter((m) => m.state === s).length}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Every machine as a square in its cell's row: one tab stop, arrow keys inside, a filter that dims the rest. A tap
 * opens the machine in the drawer (`onOpen`); `selected` is the machine the drawer shows.
 */
export function PlantMap({
  cells,
  words,
  selected,
  onOpen,
}: {
  cells: CellData[];
  words: PlantWords;
  selected?: string;
  onOpen: (code: string) => void;
}) {
  const [filter, setFilter] = useState<PlantFilter>('all');
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
    picked: selected ?? null,
    focus,
    onPick: (code) => {
      setActive(code);
      onOpen(code);
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
      <p className="v2-sub">{words.hint}</p>
      <PlantLegend machines={all} words={words} />
    </Panel>
  );
}
