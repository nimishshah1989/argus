/* eslint-disable i18next/no-literal-string -- group and screen ids, anchors and hrefs only; every visible word goes through t() */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FIGURE_LABELS } from '../../analytics/groups.js';
import { guideFigureLinks } from '../../analytics/guide-entries.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { EntityShell } from '../entity/EntityShell.js';
import { LiveFrame } from '../live-frame.js';
import { guideModel, shownEntries, type GuideChipId, type GuideItem } from './model.js';

function Entry({ item }: { item: GuideItem }) {
  const { t } = useTranslation();
  const { entry } = item;
  const links = guideFigureLinks(entry);
  return (
    <section id={item.anchor} aria-labelledby={`${item.anchor}-h`}>
      <h3 id={`${item.anchor}-h`}>
        {t(entry.titleKey)}{' '}
        {entry.built === false ? (
          <KeyPill text={t('analytics.guide.unbuilt')} tone="neutral" />
        ) : null}
      </h3>
      {entry.built !== false ? (
        <>
          {entry.bodyKeys.map((key) => (
            <p key={key}>{t(key)}</p>
          ))}
          {entry.formulaKey === undefined ? null : <p>{t(entry.formulaKey)}</p>}
        </>
      ) : (
        <p>{t('analytics.guide.notBuilt')}</p>
      )}
      {links.length === 0 ? null : (
        <ul>
          {links.map((link) => (
            <li key={link.figure}>
              <Link to={link.href} className="v2-link">
                {t('analytics.guide.openFigure')} —{' '}
                <span>{t(FIGURE_LABELS[link.figure] ?? 'analytics.figure.unknown')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The Guide always shows the way out to the desk, even for roles whose rail omits it (as v1 did). */
function withDesk(nav: NavItem[], label: string): NavItem[] {
  return nav.some((i) => i.id === 'desk')
    ? nav
    : [...nav, { id: 'desk', label, icon: 'list', href: '/desk', end: true }];
}

/** The Guide: the takeaway, the topic chips, the 36 contents links, then the entries the chip shows. */
export function GuidePage() {
  const { t } = useTranslation();
  const model = useMemo(() => guideModel(), []);
  const [chip, setChip] = useState<GuideChipId>('all');
  const { group, n, total, unbuilt } = model.takeaway;
  return (
    <LiveFrame entry={{ group: 'guide', section: 'guide', screen: 'guide' }}>
      {(nav) => (
        <EntityShell nav={withDesk(nav, t('nav.desk'))} title={t('analytics.guide.title')}>
          <p>{t('analytics.guide.intro')}</p>
          <Takeaway
            data={{
              text: t('analytics.guide.takeaway', {
                group: t(`analytics.guide.group.${group}`),
                n,
                total,
                unbuilt,
              }),
              tone: 'neutral',
              tag: t('analytics.guide.heading'),
            }}
          />
          <div className="v2-chips" role="group" aria-label={t('analytics.guide.heading')}>
            {model.chips.map((c) => (
              <button
                key={c.id}
                type="button"
                className="v2-chip"
                aria-pressed={c.id === chip}
                onClick={() => setChip(c.id)}
              >
                {t(c.label)} {c.count}
              </button>
            ))}
          </div>
          <nav aria-label={t('analytics.guide.contents')}>
            <h3>{t('analytics.guide.contents')}</h3>
            <ol>
              {model.items.map((i) => (
                <li key={i.entry.id}>
                  <a href={`#${i.anchor}`} className="v2-link">
                    {t(i.entry.titleKey)}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          {shownEntries(model, chip).map((i) => (
            <Entry key={i.entry.id} item={i} />
          ))}
        </EntityShell>
      )}
    </LiveFrame>
  );
}
