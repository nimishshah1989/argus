/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible string goes through t() */
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button.js';
import {
  FactList,
  HistoryList,
  MinuteTiles,
  PersonRows,
  SectionTitle,
  type HistoryItem,
} from '../ui/detail-kit.js';
import { Grid, Stack } from '../ui/layout.js';
import { TopBar } from '../ui/top-bar.js';

const AT = '2026-11-14T09:58:00.000Z';

function PeopleAndHistory() {
  const { t } = useTranslation();
  const history: HistoryItem[] = [
    {
      key: 1,
      tone: 'danger',
      title: t('timeline.down'),
      at: AT,
      when: '09:58',
      detail: 'Person 11',
    },
    {
      key: 2,
      tone: 'info',
      title: t('timeline.start'),
      at: AT,
      when: '10:10',
      detail: 'Person 07',
    },
    {
      key: 3,
      tone: 'muted',
      title: t('timeline.update'),
      at: AT,
      when: '10:20',
      detail: 'Alarm 1022',
    },
    { key: 4, tone: 'hold', title: t('timeline.pause'), at: AT, when: '10:30', detail: 'Spare' },
  ];
  return (
    <>
      <SectionTitle>{t('detail.people')}</SectionTitle>
      <PersonRows
        rows={[
          {
            key: 'a',
            name: 'Person 07',
            sub: t('detail.joined', { role: t('role.lead'), time: '10:10' }),
            value: '46 min',
          },
        ]}
      />
      <SectionTitle>{t('detail.history')}</SectionTitle>
      <HistoryList items={history} />
    </>
  );
}

/** The ticket detail pieces (design lock B2, B3), built from the app's own detail and action copy. */
export function DetailKitSection() {
  const { t } = useTranslation();
  return (
    <section data-testid="gallery-detail-kit" aria-labelledby="gallery-detail-kit-h">
      <Stack>
        <h2 id="gallery-detail-kit-h" className="text-title3 font-semibold">
          {t('ticket.facts')}
        </h2>
        <div>
          <TopBar back={{ to: '#detail', label: t('detail.back') }} />
        </div>
        <FactList
          rows={[
            { label: t('detail.fact.type'), value: t('detail.kind.stopped') },
            { label: t('detail.fact.workTime'), value: t('detail.running', { time: '46 min' }) },
            { label: t('detail.fact.downtime'), value: t('detail.soFar', { time: '1 h 16 min' }) },
          ]}
        />
        <SectionTitle>{t('detail.minutes')}</SectionTitle>
        <MinuteTiles
          tiles={[
            {
              label: t('detail.tile.downtime'),
              value: '1 h 16 min',
              hint: t('detail.hint.stopped'),
            },
            {
              label: t('detail.tile.workTime'),
              value: '46 min',
              hint: t('detail.hint.handsOn'),
            },
            { label: t('detail.tile.waiting'), value: '18 min', hint: 'Spare' },
          ]}
        />
        <PeopleAndHistory />
        <SectionTitle>{t('action.aria')}</SectionTitle>
        <Button>{t('detail.action.closeReport')}</Button>
        <Button variant="secondary">{t('action.label.join')}</Button>
        <Grid columns={2} gap={2}>
          <Button variant="secondary">{t('action.label.pause')}</Button>
          <Button variant="secondary">{t('action.label.transfer')}</Button>
        </Grid>
        <Button variant="quiet-danger">{t('detail.action.cancel')}</Button>
      </Stack>
    </section>
  );
}
