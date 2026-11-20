/* eslint-disable i18next/no-literal-string -- sort keys, entity kinds and typed unions only; every visible word comes from the model */
import { useContext } from 'react';
import { DataTable, type Column, type FilterChip } from '../../../ui/v2/data-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { EntityChip, EntityOpenContext } from '../../../ui/v2/entity-chip.js';
import { FigureTile } from '../../../ui/v2/figure-tile.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Row } from '../../../ui/v2/row.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import type { FixCase, FixFinderModel, FixFinderWords } from './model.js';

const FULL = 100;

function columns(words: FixFinderWords['cases']): Column<FixCase>[] {
  const c = words.columns;
  return [
    {
      key: 'match',
      label: c.match,
      numeric: true,
      sortBy: (r) => r.match.value,
      cell: (r) => r.match.shown,
    },
    { key: 'date', label: c.date, sortBy: (r) => r.date.value, cell: (r) => r.date.shown },
    {
      key: 'machine',
      label: c.machine,
      sortBy: (r) => r.machine.label,
      cell: (r) => <EntityChip {...r.machine} />,
    },
    { key: 'problem', label: c.problem, sortBy: (r) => r.problem, cell: (r) => r.problem },
    { key: 'done', label: c.done, sortBy: (r) => r.done, cell: (r) => r.done },
    {
      key: 'down',
      label: c.down,
      numeric: true,
      sortBy: (r) => r.down.value,
      cell: (r) => r.down.shown,
    },
    {
      key: 'doneBy',
      label: c.doneBy,
      sortBy: (r) => r.doneBy.map((p) => p.label).join(', '),
      cell: (r) =>
        r.doneBy.length === 0 ? (
          <span className="v2-sub">{words.nobody}</span>
        ) : (
          <div className="v2-row v2-gap-6">
            {r.doneBy.map((p) => (
              <EntityChip key={p.id} {...p} />
            ))}
          </div>
        ),
    },
  ];
}

function CasesTable({ model }: { model: FixFinderModel }) {
  const open = useContext(EntityOpenContext);
  const { current } = useEntityParam();
  const words = model.words.cases;
  const filters: FilterChip<FixCase>[] = [
    { key: 'all', label: words.filters.all },
    { key: 'full', label: words.filters.full, test: (r) => r.match.value >= FULL },
    { key: 'partial', label: words.filters.partial, test: (r) => r.match.value < FULL },
  ];
  return (
    <DataTable
      rows={model.cases}
      rowKey={(r) => r.id}
      columns={columns(words)}
      filters={filters}
      text={(r) =>
        `${r.machine.label} ${r.problem} ${r.done} ${r.doneBy.map((p) => p.label).join(' ')}`
      }
      words={words}
      initialSort={{ key: 'match', dir: 'desc' }}
      selected={current?.kind === 'machine' ? current.id : undefined}
      onOpen={(r) => open({ kind: 'machine', id: r.machine.id })}
    />
  );
}

/**
 * Fix Finder: the verdict, the engine's four figures as it printed them, and every similar past breakdown with what
 * fixed it. A machine or a person chip opens its detail in the drawer, which lives in the URL.
 */
export function FixFinderView({
  model,
  nav,
  title,
}: {
  model: FixFinderModel;
  nav: NavItem[];
  title: string;
}) {
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      <Row cols={4}>
        {model.figures.map((figure) => (
          <FigureTile key={figure.id} figure={figure} />
        ))}
      </Row>
      <CasesTable model={model} />
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
