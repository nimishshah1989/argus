/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { askWhoIsActing, clearToken, getBrand, getMe, signOut, type Me } from '../../api.js';
import { chooseLanguage, GUJARATI_ON, type Language } from '../../i18n/index.js';
import { disablePush } from '../../push.js';
import { mayOpenDesk } from '../../roles.js';
import {
  ArrowRightLeft,
  ChevronRight,
  CirclePlus,
  KeyRound,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  type IconComponent,
} from '../icon.js';
import { AlertsCard, usePushBinding } from './alerts-card.js';
import { BottomSheet } from './bottom-sheet.js';
import { Button } from './button.js';
import { DangerButton } from './floor-kit.js';
import { Segmented } from './segmented.js';

/**
 * v1's `components/AccountSheet` on the v2 kit (S27 Account frame), for any face without the v2 Shell: who is
 * signed in and acting, Change person on a shared phone, Desk / Floor, the language, alerts, Change password, and
 * Sign out behind one question. The same behaviour as v1, line for line; only the look is the kit's.
 */

const ROLE_KEYS: Record<string, string> = {
  operator: 'account.role.operator',
  technician: 'account.role.technician',
  supervisor: 'account.role.supervisor',
  head: 'account.role.head',
  plant_head: 'account.role.plantHead',
  admin: 'account.role.admin',
  board: 'account.role.board',
};

const LANGUAGES: { key: Language; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'gu', label: 'ગુજરાતી' },
];

/** The signed-in person (or the acting one). */
const shownName = (user: Me) => user.actingPerson?.name ?? user.name;

/** The person button: the icon and the word "Account", 44 px tall. Keeps the phone's alerts on the acting person. */
export function AccountButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const user = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user;
  usePushBinding(user?.actingPersonId || undefined);
  if (!user) return null;
  return (
    <button type="button" onClick={onClick} className="v2-btn v2-btn-ghost v2-account-btn">
      <UserRound aria-hidden size={18} />
      {t('account.aria')}
    </button>
  );
}

function Header({ user, company }: { user: Me; company: string }) {
  const { t } = useTranslation();
  const grant = Boolean(user.supportGrantId);
  const role = t(ROLE_KEYS[user.role] ?? user.role);
  const chip = grant
    ? t('account.supportRole', { role })
    : user.shared
      ? t('account.sharedPhone')
      : role;
  return (
    <div className="v2-account-head">
      <span className="v2-account-avatar">
        <UserRound aria-hidden size={26} />
      </span>
      <div className="v2-account-who">
        <p className="v2-floor-code">{user.shared ? user.username : user.name}</p>
        <p className="v2-sub">{t('account.signedInAs', { username: user.username, company })}</p>
        <span className={`v2-pill ${grant || !user.shared ? 'v2-pill-plan' : 'v2-pill-neutral'}`}>
          {chip}
        </span>
      </div>
    </div>
  );
}

function LanguageChoice() {
  const { t, i18n } = useTranslation();
  return (
    <div className="v2-account-block">
      <span className="v2-sub">{t('account.language')}</span>
      <Segmented
        label={t('account.language')}
        options={LANGUAGES}
        value={i18n.language === 'gu' ? 'gu' : 'en'}
        onChange={(key) => void chooseLanguage(key)}
      />
    </div>
  );
}

/** One navigation row in the sheet: icon, words, a chevron; the whole row is the target. */
function NavRow({ to, icon: RowIcon, label }: { to: string; icon: IconComponent; label: string }) {
  return (
    <Link to={to} className="v2-account-row">
      <span className="v2-floor-inline">
        <RowIcon aria-hidden size={20} />
        {label}
      </span>
      <ChevronRight aria-hidden size={20} />
    </Link>
  );
}

function Body({ user, onSignOut }: { user: Me; onSignOut: () => void }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const company = useQuery({ queryKey: ['brand'], queryFn: getBrand }).data?.company ?? '';
  const grant = Boolean(user.supportGrantId);
  const onDesk = pathname === '/desk' || pathname.startsWith('/desk/');
  return (
    <>
      <Header user={user} company={company} />
      {grant ? (
        <div role="note" className="v2-card v2-floor-note" data-tone="plan">
          <p className="v2-h3 v2-floor-inline">
            <ShieldCheck aria-hidden size={20} />
            {t('account.support.title')}
          </p>
          <p className="v2-floor-note-text">{t('account.support.body', { company })}</p>
        </div>
      ) : null}
      {user.shared ? (
        <div className="v2-card v2-floor-card">
          <p className="v2-sub">{t('account.actingNow')}</p>
          <p className="v2-floor-code">{shownName(user)}</p>
          <Button onClick={askWhoIsActing}>
            <ArrowRightLeft aria-hidden size={20} />
            {t('account.changePerson')}
          </Button>
          <p className="v2-sub">{t('account.actingNote')}</p>
        </div>
      ) : null}
      {onDesk ? <NavRow to="/floor" icon={CirclePlus} label={t('account.floor')} /> : null}
      {!onDesk && mayOpenDesk(user.role) ? (
        <NavRow to="/desk" icon={Menu} label={t('account.desk')} />
      ) : null}
      {GUJARATI_ON ? <LanguageChoice /> : null}
      <AlertsCard personId={user.actingPersonId || undefined} />
      {grant ? null : <NavRow to="/password" icon={KeyRound} label={t('account.changePassword')} />}
      <DangerButton onClick={onSignOut}>
        <LogOut aria-hidden size={20} />
        {t('account.signOut')}
      </DangerButton>
    </>
  );
}

/** The one sign-out question, asked before the session ends. */
export function SignOutPrompt({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <p className="v2-sub">{t('account.signOutBody')}</p>
      <div className="v2-floor-pair">
        <Button onClick={onCancel}>{t('account.goBack')}</Button>
        <Button primary onClick={onConfirm}>
          {t('account.signOut')}
        </Button>
      </div>
    </>
  );
}

/** Ending this phone's session also ends its alerts, so a signed-out phone never rings. */
export async function leaveThisPhone(): Promise<void> {
  await disablePush();
  await signOut().catch(() => undefined);
  clearToken();
}

/** The account sheet: a bottom sheet on a phone, a right panel on desktop. Sign out asks first. */
export function AccountSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user;
  const [confirming, setConfirming] = useState(false);
  if (!user) return null;
  const close = (next: boolean) => {
    if (!next) setConfirming(false);
    onOpenChange(next);
  };
  async function signOutNow() {
    await leaveThisPhone();
    navigate('/login');
  }
  return (
    <BottomSheet
      open={open}
      onOpenChange={close}
      title={confirming ? t('account.signOutTitle') : t('account.title')}
    >
      {confirming ? (
        <SignOutPrompt onCancel={() => setConfirming(false)} onConfirm={() => void signOutNow()} />
      ) : (
        <Body user={user} onSignOut={() => setConfirming(true)} />
      )}
    </BottomSheet>
  );
}
