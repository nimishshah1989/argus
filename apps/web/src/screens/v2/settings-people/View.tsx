/* eslint-disable i18next/no-literal-string -- query keys only; every visible word goes through t() */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { LoginAdmin, PersonAdmin } from '@uptimo/shared/people';
import { getMe } from '../../../api.js';
import { defineResource } from '../../../data/index.js';
import type { CrudRow, CrudSpec } from '../../../patterns/crud-spec.js';
import { CrudPage } from '../../../ui/v2/crud-page.js';
import { Takeaway, type TakeawayData } from '../../../ui/v2/takeaway.js';
import { loginsTakeaway, peopleTakeaway } from './model.js';
import { loginsSpec, peopleSpec } from './people-specs.js';

/** The rows of a list the page itself reads: the same cached query, whole (`nextCursor` is null). */
function useRows<Row extends CrudRow>(spec: CrudSpec<Row>): Row[] {
  const list = defineResource<unknown, Row>(spec).useList();
  return list.data?.pages.flatMap((p) => p.items) ?? [];
}

function NoAccess() {
  const { t } = useTranslation();
  return (
    <>
      <h2>{t('plant.noAccess')}</h2>
      <p>{t('plant.noAccess.body')}</p>
    </>
  );
}

/** Admin only, as v1: anyone else gets the refusal and the list is never asked for. */
function AdminOnly({ children }: { children: React.ReactNode }) {
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const role = me.data?.user.role;
  return role && role !== 'admin' ? <NoAccess /> : children;
}

function Page<Row extends CrudRow>({
  spec,
  lead,
}: {
  spec: CrudSpec<Row>;
  lead: TakeawayData | null;
}) {
  return <CrudPage spec={spec} lead={lead ? <Takeaway data={lead} /> : null} />;
}

function People() {
  const { t } = useTranslation();
  const lead = peopleTakeaway(useRows<PersonAdmin>(peopleSpec));
  return (
    <Page
      spec={peopleSpec}
      lead={
        lead && {
          text: t('people.takeaway.noPhone', lead),
          tone: lead.noPhone > 0 ? 'risk' : 'neutral',
          tag: t('people.title'),
        }
      }
    />
  );
}

function Logins() {
  const { t } = useTranslation();
  const lead = loginsTakeaway(useRows<LoginAdmin>(loginsSpec));
  return (
    <Page
      spec={loginsSpec}
      lead={
        lead && {
          text: t('people.takeaway.shared', lead),
          tone: 'neutral',
          tag: t('people.logins.title'),
        }
      }
    />
  );
}

export function PeopleView() {
  return (
    <AdminOnly>
      <People />
    </AdminOnly>
  );
}

export function LoginsView() {
  return (
    <AdminOnly>
      <Logins />
    </AdminOnly>
  );
}
