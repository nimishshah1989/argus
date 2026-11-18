import { useState } from 'react';
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
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Stack } from '../../ui/layout.js';
import { Card, FilterBar, Tiles, type Person } from './action-center-parts.js';
import {
  actionCenterView,
  filterCards,
  severityGroups,
  type ActionCenterView,
  type CardAction,
  type CardFilters,
  type NudgeCard,
} from './action-center.js';
import { DataTable } from './parts.js';

/**
 * The Action Center (ticket 44, packet 44d): the platform's screen over 44c's board. Four tiles, four status
 * tabs, the priority and type filters and a search; one card per nudge with its machines, evidence and stake;
 * Acknowledge (owner, due, note), Snooze and Resolved on an open nudge, Reopen on a stored one. The mapping is
 * pure (action-center.ts); this file only fetches, holds the filters and sends the three writes.
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

/** The risk table: the board's eight rows, each machine a link to its page. */
function RiskTable({ view }: { view: ActionCenterView }) {
  const { t } = useTranslation();
  return (
    <DataTable
      title={t('analytics.actionCenter.risk.title')}
      header={[
        t('analytics.actionCenter.risk.machine'),
        t('analytics.actionCenter.risk.score'),
        t('analytics.actionCenter.risk.why'),
      ]}
      rows={view.risk.map((row) => [row.label, row.score, row.why])}
      renderCell={(cell, rowIndex, columnIndex) => {
        const row = view.risk[rowIndex];
        return columnIndex === 0 && row !== undefined ? (
          <Link
            to={row.href}
            className="inline-flex min-h-target-min items-center font-semibold text-accent-text"
          >
            {cell}
          </Link>
        ) : (
          cell
        );
      }}
    />
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

/** The board once readable: the risk table, the tabs and filters, then the cards under their priorities. */
function Board({ view, people }: { view: ActionCenterView; people: readonly Person[] }) {
  const { t } = useTranslation();
  const { filters, change } = useCardFilters();
  const { write, reopen } = useNudgeWrites();
  const [form, setForm] = useState<string | null>(null);
  const act = (card: NudgeCard, action: CardAction) => {
    if (action === REOPEN) reopen.mutate(card.key);
    else if (action === SNOOZE || action === RESOLVED)
      write.mutate({ key: card.key, body: { status: action } });
  };
  const groups = severityGroups(filterCards(view.cards, filters));
  return (
    <Stack gap={4}>
      <Tiles view={view} />
      <RiskTable view={view} />
      <FilterBar view={view} filters={filters} onChange={change} />
      {write.isError || reopen.isError ? (
        <p role="alert" className="text-body font-medium text-danger-ink">
          {t('analytics.actionCenter.saveFailed')}
        </p>
      ) : null}
      {groups.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-body text-neutral-600 shadow-card">
          {filters.status === 'open'
            ? t('analytics.actionCenter.emptyOpen')
            : t('analytics.actionCenter.empty')}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.severity} className="flex flex-col gap-2">
            <h3 className="text-title3 font-semibold">{t(group.labelKey)}</h3>
            <ul className="flex flex-col gap-3">
              {group.cards.map((card) => (
                <li key={card.key}>
                  <Card
                    card={card}
                    snoozeDays={view.snoozeDays}
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
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </Stack>
  );
}

export function ActionCenterPage() {
  const { t } = useTranslation();
  const online = useOnline();
  const board = useActionCenterBoard();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  if (isRefused(me.data?.user, board.error))
    return (
      <div data-page="refused" className="rounded-2xl bg-surface p-4 shadow-card">
        <p role="status" className="text-body font-medium text-danger-ink">
          {t('analytics.actionCenter.refused')}
        </p>
      </div>
    );
  const state = viewState({
    online,
    hasData: board.data !== undefined,
    isEmpty: false,
    error: board.error,
  });
  if (state !== 'ready' || board.data === undefined)
    return (
      <StateNotice
        state={state as Exclude<ViewState, 'ready'>}
        empty={t('analytics.actionCenter.emptyOpen')}
        onRetry={() => void board.refetch()}
      />
    );
  const machines = config.data?.machines ?? [];
  const labelOf = (id: string) => machines.find((machine) => machine.id === id)?.code ?? id;
  const view = actionCenterView(board.data, config.data?.timeZone ?? 'UTC', labelOf);
  const people = config.data?.people.filter((person) => person.active) ?? [];
  return (
    <Stack gap={4}>
      <div className="flex flex-col gap-1">
        <h2 className="text-title2 font-semibold">{t('analytics.screen.action-center')}</h2>
        <p className="max-w-3xl text-body text-neutral-600">
          {t('analytics.actionCenter.intro', { date: view.asOf })}
        </p>
      </div>
      <Board view={view} people={people} />
    </Stack>
  );
}
