/* eslint-disable i18next/no-literal-string -- routes, ids and prop values only; every visible word goes through t() */
import { useQueries, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import type { GlossaryReply, ListItemReply } from '@uptimo/shared/plant-settings';
import { defineResource } from '../../../data/index.js';
import { CrudPage } from '../../../ui/v2/crud-page.js';
import { DataTable, type Column } from '../../../ui/v2/data-table.js';
import { Takeaway, type TakeawayData } from '../../../ui/v2/takeaway.js';
import { analyticsProfileSpec, type ProfileRow } from './analytics-profile-spec.js';
import { LIST_PAGES, glossarySpec, listMenu, type ListsPage } from './lists-specs.js';
import { glossaryTakeaway, listsTakeaway, profileTakeaway } from './model.js';

const pct = (n: number, total: number) => Math.round((n / total) * 100);

function Lead({ data }: { data: TakeawayData | null }) {
  return data ? <Takeaway data={data} /> : null;
}

/** An entry of one list, with the list it belongs to. */
type Entry = ListItemReply & { page: ListsPage };

/** Every active entry across the six lists; a row's name opens its list. */
function AllEntries({
  entries,
  titleOf,
}: {
  entries: Entry[];
  titleOf: (page: ListsPage) => string;
}) {
  const { t } = useTranslation();
  const columns: Column<Entry>[] = [
    {
      key: 'label',
      label: t('lists.field.label'),
      sortBy: (row) => row.label,
      cell: (row) => (
        <Link to={`/settings/lists?list=${row.page}`} className="v2-link">
          {row.label}
        </Link>
      ),
    },
    {
      key: 'list',
      label: t('lists.col.list'),
      sortBy: (r) => titleOf(r.page),
      cell: (r) => titleOf(r.page),
    },
  ];
  return (
    <DataTable
      rows={entries}
      rowKey={(row) => `${row.page}-${row.id}`}
      columns={columns}
      headed
      filters={[]}
      text={(row) => `${row.label} ${row.code} ${titleOf(row.page)}`}
      words={{
        title: t('lists.all.table'),
        search: t('lists.search'),
        showing: t('v2m.showing'),
        noResults: t('v2m.noResults'),
        open: t('kit.crud.edit'),
      }}
    />
  );
}

/** The hub: one tile per list, then every active entry across the six in one read-only table. */
function ListsHub() {
  const { t } = useTranslation();
  const lists = useQueries({
    queries: LIST_PAGES.map(({ page, spec }) => ({
      queryKey: [spec.key, 'hub'],
      queryFn: async () => (await defineResource<unknown, ListItemReply>(spec).list()).items,
      select: (items: ListItemReply[]) => items.map((item): Entry => ({ ...item, page })),
    })),
  });
  const entries = lists.flatMap((list) => (list.data ?? []).filter((item) => item.active));
  const counts = LIST_PAGES.map(({ page }) => ({
    page,
    n: entries.filter((entry) => entry.page === page).length,
  }));
  const top = lists.some((list) => list.data === undefined) ? null : listsTakeaway(counts);
  const titleOf = (page: ListsPage) => t(LIST_PAGES.find((p) => p.page === page)!.titleKey);
  const menu = listMenu(LIST_PAGES);
  return (
    <div className="v2-crud">
      <h2 className="v2-h2">{t('lists.title')}</h2>
      <Lead
        data={
          top
            ? {
                text: t('lists.takeaway', {
                  label: titleOf(top.page),
                  pct: pct(top.n, top.total),
                  n: top.n,
                  total: top.total,
                }),
                tone: 'neutral',
                tag: t('lists.tag'),
              }
            : null
        }
      />
      <p className="v2-crud-hint">{t('lists.intro')}</p>
      <ul className="v2-tile-set">
        {menu.map((row, index) => (
          <li key={row.to}>
            <Link to={row.to} className="v2-link">
              <strong>{t(row.titleKey)}</strong>
              <span className="v2-crud-sub">{t(row.subKey)}</span>
              <span className="v2-sub">{counts[index]!.n}</span>
            </Link>
          </li>
        ))}
      </ul>
      {entries.length > 0 ? <AllEntries entries={entries} titleOf={titleOf} /> : null}
    </div>
  );
}

/** `?list=<page>` is that list's kit page; no or unknown page is the hub. */
export function ListsView() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const chosen = LIST_PAGES.find((page) => page.page === params.get('list'));
  if (!chosen) return <ListsHub />;
  return (
    <div className="v2-stack">
      <Link to="/settings/lists" className="v2-link">
        {t('lists.all')}
      </Link>
      <CrudPage key={chosen.page} spec={chosen.spec} />
    </div>
  );
}

/** The glossary: the kit page, led by how much of it is written in Gujarati script. */
export function GlossaryView() {
  const { t } = useTranslation();
  const terms = useQuery({
    queryKey: [glossarySpec.key, 'lead'],
    queryFn: async () => (await defineResource<unknown, GlossaryReply>(glossarySpec).list()).items,
  });
  const top = glossaryTakeaway(terms.data ?? []);
  return (
    <CrudPage
      spec={glossarySpec}
      lead={
        <Lead
          data={
            top
              ? {
                  text: t('lists.glossary.takeaway', { pct: pct(top.gu, top.total) }),
                  tone: 'neutral',
                  tag: t('lists.tag'),
                }
              : null
          }
        />
      }
    />
  );
}

/** The analytics profile: still one form; the takeaway and a bar say how many numbers are not set yet. */
export function ProfileView() {
  const { t } = useTranslation();
  const rows = useQuery({
    queryKey: [analyticsProfileSpec.key, 'lead'],
    queryFn: async () =>
      (await defineResource<unknown, ProfileRow>(analyticsProfileSpec).list()).items,
  });
  const row = rows.data?.[0];
  const top = row ? profileTakeaway(row) : null;
  const set = top ? top.total - top.notSet.length : 0;
  return (
    <CrudPage
      spec={analyticsProfileSpec}
      lead={
        top && top.total > 0 ? (
          <>
            <Lead
              data={{
                text: t('lists.profile.takeaway', { n: top.notSet.length, total: top.total }),
                tone: top.notSet.length > 0 ? 'risk' : 'gain',
                tag: t('lists.tag'),
              }}
            />
            <div
              className="v2-kpi-meter"
              role="progressbar"
              aria-label={t('lists.profile.progress', { n: set, total: top.total })}
              aria-valuemin={0}
              aria-valuemax={top.total}
              aria-valuenow={set}
            >
              <span style={{ width: `${pct(set, top.total)}%` }} />
            </div>
          </>
        ) : null
      }
    />
  );
}
