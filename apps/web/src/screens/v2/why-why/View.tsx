/* eslint-disable i18next/no-literal-string -- sort keys, entity kinds and typed unions only; every visible word comes from the model */
import { useContext } from 'react';
import { DataTable, type Column, type FilterChip } from '../../../ui/v2/data-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { WhyForm } from '../../../ui/v2/domain/why-form.js';
import { DrillAction } from '../../../ui/v2/drill-action.js';
import { EntityChip, EntityOpenContext } from '../../../ui/v2/entity-chip.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import type { WhyWhyActions, WhyWhyModel, WhyWhyRow, WhyWhyWords } from './model.js';

function columns(words: WhyWhyWords, actions: WhyWhyActions | undefined): Column<WhyWhyRow>[] {
  const c = words.table.columns;
  const all: Column<WhyWhyRow>[] = [
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
  // A row with no ticket named beside it offers no action: nothing is saved against a guessed ticket.
  if (actions?.write)
    all.push({
      key: 'action',
      label: words.action.column,
      cell: (r) =>
        r.ticketId === null ? null : (
          <button
            type="button"
            className="v2-btn v2-btn-ghost v2-btn-small"
            onClick={(event) => (event.stopPropagation(), actions.onStart(r))}
          >
            {r.status.done ? words.action.view : words.action.start}
          </button>
        ),
    });
  return all;
}

/**
 * A form belongs to its ticket, not to the row it was started from: when the figures refresh and another breakdown takes
 * that row, a form opened on the first ticket stays the first ticket's and a new Start opens a fresh one.
 */
export const whyFormKey = (form: { ticketId: string; record: unknown }): string =>
  `${form.ticketId}:${form.record === null ? 'new' : 'saved'}`;

/** What the signed-in person is told and the one open form: the refusal, a failure from the server, the form. */
function Writes({ words, actions }: { words: WhyWhyWords; actions: WhyWhyActions }) {
  const form = actions.open;
  return (
    <>
      {actions.write ? null : (
        <p role="status" className="v2-sub">
          {words.action.refused}
        </p>
      )}
      {actions.failure ? (
        <p role="alert" className="v2-sub">
          {actions.failure}
        </p>
      ) : null}
      {form ? (
        <WhyForm
          key={whyFormKey(form)}
          words={words.form}
          heading={`${form.machine} · ${form.date}`}
          author={actions.author}
          initial={form.record}
          completed={form.completed}
          saving={actions.saving}
          saved={actions.saved}
          onSave={actions.onSave}
          onPdf={actions.onPdf}
          onCancel={actions.onCancel}
        />
      ) : null}
    </>
  );
}

/**
 * Why-Why: the verdict and the engine's candidate list, every row, with the status as a tag and the machine as a chip.
 * For a role that may save, each row starts or opens its own Why-Why above the table (five whys and a required
 * conclusion, written against that row's ticket, with the saved record's PDF); any other role is told it may not.
 */
export function WhyWhyView({
  model,
  nav,
  title,
  actions,
}: {
  model: WhyWhyModel;
  nav: NavItem[];
  title: string;
  actions?: WhyWhyActions;
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
      {actions ? <Writes words={words} actions={actions} /> : null}
      <DataTable
        rows={model.rows}
        rowKey={(r) => r.id}
        columns={columns(words, actions)}
        filters={filters}
        text={(r) => `${r.machine.label} ${r.problem} ${r.status.text}`}
        words={words.table}
        selected={current?.kind === 'machine' ? current.id : undefined}
        onOpen={(r) => open(r.machine)}
      />
      {model.drill ? (
        <div>
          <DrillAction drill={model.drill} />
        </div>
      ) : null}
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
