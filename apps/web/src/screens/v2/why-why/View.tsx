/* eslint-disable i18next/no-literal-string -- sort keys, entity kinds and typed unions only; every visible word comes from the model */
import { useContext } from 'react';
import { DataTable, type Column, type FilterChip } from '../../../ui/v2/data-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { EntityChip, EntityOpenContext } from '../../../ui/v2/entity-chip.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import type { WhyWhyModel, WhyWhyRow, WhyWhyWords } from './model.js';

/** Until a row can name its ticket, starting a Why-Why stays on the current page. */
const CURRENT_PAGE = '/analytics/breakdowns?screen=a6-why-why';

function columns(words: WhyWhyWords['table']): Column<WhyWhyRow>[] {
  const c = words.columns;
  return [
    {
      key: 'machine',
      label: c.machine,
      sortBy: (r) => r.machine.label,
      cell: (r) => <EntityChip {...r.machine} />,
    },
    { key: 'date', label: c.date, sortBy: (r) => r.date.value, cell: (r) => r.date.shown },
    { key: 'problem', label: c.problem, sortBy: (r) => r.problem, cell: (r) => r.problem },
    {
      key: 'down',
      label: c.down,
      numeric: true,
      sortBy: (r) => r.down.value,
      cell: (r) => r.down.shown,
    },
    {
      key: 'status',
      label: c.status,
      sortBy: (r) => r.status.text,
      cell: (r) => (
        <KeyPill
          text={r.status.text}
          tone={r.status.done ? 'gain' : 'neutral'}
          icon={r.status.done ? 'check' : 'clock'}
        />
      ),
    },
  ];
}

/**
 * Why-Why: the verdict and the engine's candidate list, every row, with the status as a tag and the machine as a chip.
 * Saving a Why-Why waits for the server to name each row's ticket, so the page says so and links the current page.
 */
export function WhyWhyView({
  model,
  nav,
  title,
}: {
  model: WhyWhyModel;
  nav: NavItem[];
  title: string;
}) {
  const open = useContext(EntityOpenContext);
  const { current } = useEntityParam();
  const words = model.words;
  const filters: FilterChip<WhyWhyRow>[] = [
    { key: 'all', label: words.table.filters.all },
    { key: 'todo', label: words.table.filters.todo, test: (r) => !r.status.done },
    { key: 'done', label: words.table.filters.done, test: (r) => r.status.done },
  ];
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={words.why} />
      <DataTable
        rows={model.rows}
        rowKey={(r) => r.id}
        columns={columns(words.table)}
        filters={filters}
        text={(r) => `${r.machine.label} ${r.problem} ${r.status.text}`}
        words={words.table}
        selected={current?.kind === 'machine' ? current.id : undefined}
        onOpen={(r) => open(r.machine)}
      />
      <p className="v2-sub">
        {words.startNote} <a href={CURRENT_PAGE}>{words.startLink}</a>
      </p>
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
