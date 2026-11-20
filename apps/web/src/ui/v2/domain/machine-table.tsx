import { DataTable, type Column, type FilterChip, type TableWords } from '../data-table.js';
import { KeyPill } from '../key-pill.js';
import { Sparkline } from '../sparkline.js';
import {
  STATE_ICON,
  STATE_TONE,
  type MachineData,
  type MachineState,
  type PlantFilter,
} from './plant.js';

export type MachineTableWords = TableWords & {
  columns: { machine: string; status: string; hours: string; stops: string; trend: string };
  states: Record<MachineState, string>;
  filters: Record<PlantFilter, string>;
};

const FILTERS: PlantFilter[] = ['all', 'down', 'risk', 'pm'];
const WORST_FIRST = { key: 'hours', dir: 'desc' } as const;

/** Who the machine is: its code in its type's colour, its name, and where it stands. */
function Identity({ m }: { m: MachineData }) {
  return (
    <div className="v2-who">
      <span className="v2-code" data-cat={m.cat}>
        {m.code}
      </span>
      <div>
        <div className="v2-who-name">{m.name}</div>
        <div className="v2-sub">
          {m.typeLabel} · {m.cell}
        </div>
      </div>
    </div>
  );
}

/** The table's five columns: identity, state, hours this month, breakdowns in 90 days, the 12-week trend. */
function machineColumns(words: MachineTableWords): Column<MachineData>[] {
  return [
    {
      key: 'machine',
      label: words.columns.machine,
      sortBy: (m) => m.code,
      cell: (m) => <Identity m={m} />,
    },
    {
      key: 'status',
      label: words.columns.status,
      cell: (m) => (
        <KeyPill
          text={words.states[m.state]}
          tone={STATE_TONE[m.state]}
          icon={STATE_ICON[m.state]}
        />
      ),
    },
    {
      key: 'hours',
      label: words.columns.hours,
      numeric: true,
      sortBy: (m) => m.hours.value,
      cell: (m) => m.hours.shown,
    },
    {
      key: 'stops',
      label: words.columns.stops,
      numeric: true,
      sortBy: (m) => m.stops,
      cell: (m) => m.stops,
    },
    {
      key: 'trend',
      label: words.columns.trend,
      cell: (m) => (
        <Sparkline
          values={m.trend}
          tone={m.trend[m.trend.length - 1]! > m.trend[0]! ? 'loss' : 'gain'}
          width={80}
          height={24}
        />
      ),
    },
  ];
}

/** Every machine, worst first: identity, state, this month's breakdown hours, 90-day breakdowns, 12-week trend. */
export function MachineTable({
  machines,
  words,
  selected,
  onOpen,
}: {
  machines: MachineData[];
  words: MachineTableWords;
  selected?: string;
  onOpen: (code: string) => void;
}) {
  const columns = machineColumns(words);
  const filters: FilterChip<MachineData>[] = FILTERS.map((key) => ({
    key,
    label: words.filters[key],
    test: key === 'all' ? undefined : (m) => m.state === key,
  }));
  return (
    <DataTable
      rows={machines}
      rowKey={(m) => m.code}
      columns={columns}
      filters={filters}
      text={(m) => `${m.code} ${m.name} ${m.typeLabel} ${m.cell}`}
      words={words}
      initialSort={WORST_FIRST}
      selected={selected}
      onOpen={(m) => onOpen(m.code)}
    />
  );
}
