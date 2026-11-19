/* eslint-disable i18next/no-literal-string -- the template's kind and state are prop values, not copy */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { canAnalytics, type ActorContext, type Role } from '@uptimo/domain';
import type { NudgeAckBody, NudgeRule, NudgeSeverity, NudgeStatus } from '@uptimo/shared';
import {
  ApiError,
  getConfig,
  getMe,
  reopenNudge,
  useActionCenterBoard,
  writeNudge,
  type Me,
} from '../../api.js';
import { useOnline } from '../../data/index.js';
import { viewState } from '../../patterns/view-state.js';
import { DataTable, EmptyState, useClientTable } from '../../ui/elements/index.js';
import type { Column, TableLabels } from '../../ui/elements/index.js';
import { TONE_INK } from '../../ui/elements/tone.js';
import { NUDGE_SEVERITY } from '../../ui/meaning/index.js';
import { Template } from './shell/patterns/template.js';
import { NotReady } from './screen-states.js';
import { FilterBar, SeverityTiles } from './action-center-filters.js';
import { NudgeCardView, type Person } from './action-center-parts.js';
import {
  actionCenterView,
  filterCards,
  severityGroups,
  type ActionCenterView,
  type ActionRiskRow,
  type CardAction,
  type CardFilters,
  type NudgeCard,
} from './action-center.js';

/**
 * The Action Center (ticket 44, packet 44d; rebuilt on the overview template by ticket 87): four priority tiles,
 * the risk table, four status tabs with the priority, type and search filters, and one card per nudge under its
 * priority. Acknowledge (owner, due, note), Snooze and Resolved on an open nudge, Reopen on a stored one. The
 * mapping is pure (action-center.ts); this file only fetches, holds the filters and sends the writes.
 */

const SNOOZE = 'snooze' as const;
const RESOLVED = 'resolved' as const;
const REOPEN = 'reopen' as const;

function mayAct(user: Me | undefined): boolean {
  if (user === undefined) return false;
  const actor: ActorContext = {
    role: user.role as Role,
    loginId: user.id,
    personId: user.actingPersonId || null,
    shared: user.shared,
    cell: user.cell ?? null,
  };
  return canAnalytics(actor);
}

/** The honest refusal: the screen's roles are 44c's canAnalytics, and a 403 from the board means the same. */
function isRefused(user: Me | undefined, error: unknown): boolean {
  return (
    (user !== undefined && !mayAct(user)) || (error instanceof ApiError && error.status === 403)
  );
}

/** The risk table's text: its own words and the page and range lines the shared table asks for. */
function useRiskLabels(): TableLabels {
  const { t } = useTranslation();
  return {
    caption: t('analytics.actionCenter.risk.title'),
    filter: t('analytics.actionCenter.search'),
    previous: t('analytics.actionCenter.table.previous'),
    next: t('analytics.actionCenter.table.next'),
    page: (page, pages) => t('analytics.actionCenter.table.page', { page, pages }),
    range: (from, to, total) => t('analytics.actionCenter.table.range', { from, to, total }),
    empty: t('analytics.actionCenter.table.empty'),
  };
}

/** The risk table: the board's eight rows in the shared table, each machine a link to its page. */
function RiskTable({ rows }: { rows: ActionRiskRow[] }) {
  const { t } = useTranslation();
  const labels = useRiskLabels();
  const columns = useMemo<Column<ActionRiskRow>[]>(
    () => [
      {
        id: 'machine',
        header: t('analytics.actionCenter.risk.machine'),
        cell: (row) => (
          <Link
            to={row.href}
            className="inline-flex min-h-target-min items-center font-semibold text-accent-text"
          >
            {row.label}
          </Link>
        ),
      },
      {
        id: 'score',
        header: t('analytics.actionCenter.risk.score'),
        numeric: true,
        sortValue: (row) => Number(row.score),
        cell: (row) => row.score,
      },
      { id: 'why', header: t('analytics.actionCenter.risk.why'), cell: (row) => row.why },
    ],
    [t],
  );
  const table = useClientTable(rows, columns, (row) => `${row.label} ${row.why}`);
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-title3 font-semibold">{t('analytics.actionCenter.risk.title')}</h3>
      <DataTable
        columns={columns}
        rows={table.rows}
        rowKey={(row) => row.machine}
        total={table.total}
        page={table.page}
        pageSize={table.pageSize}
        sort={table.sort}
        labels={labels}
        onSort={table.onSort}
        onPage={table.onPage}
      />
    </section>
  );
}

function useCardFilters() {
  const [status, setStatus] = useState<NudgeStatus>('open');
  const [severity, setSeverity] = useState<NudgeSeverity | ''>('');
  const [rule, setRule] = useState<NudgeRule | ''>('');
  const [query, setQuery] = useState('');
  const filters: CardFilters = { status, severity, rule, query };
  const change = (next: Partial<CardFilters>) => {
    if (next.status !== undefined) setStatus(next.status);
    if (next.severity !== undefined) setSeverity(next.severity);
    if (next.rule !== undefined) setRule(next.rule);
    if (next.query !== undefined) setQuery(next.query);
  };
  return { filters, change };
}

/** The two writes; each answers the fresh board, so the query is invalidated rather than patched. */
function useNudgeWrites() {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['analytics-action-center'] });
  };
  const write = useMutation({
    mutationFn: ({ key, body }: { key: string; body: NudgeAckBody }) => writeNudge(key, body),
    onSuccess: invalidate,
  });
  const reopen = useMutation({
    mutationFn: (key: string) => reopenNudge(key),
    onSuccess: invalidate,
  });
  return { write, reopen };
}

/** A priority heading: its meaning's icon, word and count in the tone's ink, larger than the nudge titles under it. */
function GroupHeading({
  severity,
  label,
  count,
}: {
  severity: NudgeSeverity;
  label: string;
  count: number;
}) {
  const meaning = NUDGE_SEVERITY[severity];
  const Icon = meaning.icon;
  return (
    <h3 className={`flex items-center gap-2 text-title3 font-semibold ${TONE_INK[meaning.tone]}`}>
      <Icon aria-hidden size={20} className="shrink-0" />
      {label}
      <span className="text-footnote tabular-nums text-neutral-600">{count}</span>
    </h3>
  );
}

type Writes = ReturnType<typeof useNudgeWrites>;

/** One priority's cards, each with its form, its three buttons and its saved status. */
function CardList({
  cards,
  snoozeDays,
  people,
  writes,
  form,
  setForm,
}: {
  cards: readonly NudgeCard[];
  snoozeDays: number;
  people: readonly Person[];
  writes: Writes;
  /** The one card whose form is open, held by the board so opening another closes it. */
  form: string | null;
  setForm: (key: string | null) => void;
}) {
  const { write, reopen } = writes;
  const act = (card: NudgeCard, action: CardAction) => {
    if (action === REOPEN) reopen.mutate(card.key);
    else if (action === SNOOZE || action === RESOLVED)
      write.mutate({ key: card.key, body: { status: action } });
  };
  return (
    <ul className="flex flex-col gap-3">
      {cards.map((card) => (
        <NudgeCardView
          key={card.key}
          card={card}
          snoozeDays={snoozeDays}
          people={people}
          formOpen={form === card.key}
          saving={write.isPending}
          onAction={(action) => act(card, action)}
          onOpenForm={() => setForm(card.key)}
          onCancel={() => setForm(null)}
          onSave={(body) => {
            write.mutate({ key: card.key, body });
            setForm(null);
          }}
        />
      ))}
    </ul>
  );
}

/** The cards under their priorities, or the one empty line when the tab, filters and search leave none. */
function Cards({
  view,
  people,
  filters,
}: {
  view: ActionCenterView;
  people: readonly Person[];
  filters: CardFilters;
}) {
  const { t } = useTranslation();
  const writes = useNudgeWrites();
  const [form, setForm] = useState<string | null>(null);
  const groups = severityGroups(filterCards(view.cards, filters));
  return (
    <>
      {writes.write.isError || writes.reopen.isError ? (
        <p role="alert" className="text-body font-medium text-bad-ink">
          {t('analytics.actionCenter.saveFailed')}
        </p>
      ) : null}
      {groups.length === 0 ? (
        <EmptyState
          title={
            filters.status === 'open'
              ? t('analytics.actionCenter.emptyOpen')
              : t('analytics.actionCenter.empty')
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.severity} className="flex flex-col gap-3">
            <GroupHeading
              severity={group.severity}
              label={t(group.labelKey)}
              count={group.cards.length}
            />
            <CardList
              cards={group.cards}
              snoozeDays={view.snoozeDays}
              people={people}
              writes={writes}
              form={form}
              setForm={setForm}
            />
          </section>
        ))
      )}
    </>
  );
}

/** The board once readable: the tiles in the figures row, then the risk table, the filters and the cards. */
function Board({ view, people }: { view: ActionCenterView; people: readonly Person[] }) {
  const { t } = useTranslation();
  const { filters, change } = useCardFilters();
  return (
    <Template
      title={t('analytics.screen.action-center')}
      lede={t('analytics.actionCenter.intro', { date: view.asOf })}
      kind="overview"
      figures={<SeverityTiles view={view} />}
      main={
        <>
          <div data-span="full">
            <RiskTable rows={view.risk} />
          </div>
          <div data-span="full">
            <FilterBar view={view} filters={filters} onChange={change} />
          </div>
          <div data-span="full" className="flex flex-col gap-4">
            <Cards view={view} people={people} filters={filters} />
          </div>
        </>
      }
    />
  );
}

/**
 * The screen's frame with its state line in place of the board: loading, offline, empty, the error with Retry, or the
 * refusal. A refusal keeps its own look and role (a status line in the danger ink), as it always had.
 */
export function Waiting({
  state,
  refused,
  onRetry,
}: {
  state: string;
  refused: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const title = t('analytics.screen.action-center');
  if (refused)
    return (
      <Template
        title={title}
        kind="overview"
        main={
          <div data-page="refused">
            <p role="status" className="text-body font-medium text-bad-ink">
              {t('analytics.actionCenter.refused')}
            </p>
          </div>
        }
      />
    );
  return (
    <NotReady
      title={title}
      state={state}
      emptyText={t('analytics.actionCenter.emptyOpen')}
      onRetry={onRetry}
    />
  );
}

export function ActionCenterPage() {
  const online = useOnline();
  const board = useActionCenterBoard();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const refused = isRefused(me.data?.user, board.error);
  const state = viewState({
    online,
    hasData: board.data !== undefined,
    isEmpty: false,
    error: board.error,
  });
  if (refused || state !== 'ready' || board.data === undefined)
    return <Waiting state={state} refused={refused} onRetry={() => void board.refetch()} />;
  const machines = config.data?.machines ?? [];
  const labelOf = (id: string) => machines.find((machine) => machine.id === id)?.code ?? id;
  const view = actionCenterView(board.data, config.data?.timeZone ?? 'UTC', labelOf);
  const people = config.data?.people.filter((person) => person.active) ?? [];
  return <Board view={view} people={people} />;
}
