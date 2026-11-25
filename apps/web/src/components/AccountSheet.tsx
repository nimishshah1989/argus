/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { askWhoIsActing, clearToken, getBrand, getMe, signOut, type Me } from '../api.js';
import { chooseLanguage, GUJARATI_ON, type Language } from '../i18n/index.js';
import { mayOpenDesk } from '../roles.js';
import { disablePush } from '../push.js';
import { Button } from '../ui/button.js';
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
} from '../ui/icon.js';
import { Sheet } from '../ui/sheet.js';
import { AlertsCard, usePushBinding } from './AlertsCard.js';

const ROLE_KEYS: Record<string, string> = {
  operator: 'account.role.operator',
  technician: 'account.role.technician',
  supervisor: 'account.role.supervisor',
  head: 'account.role.head',
  plant_head: 'account.role.plantHead',
  admin: 'account.role.admin',
  board: 'account.role.board',
};

const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'gu', label: 'ગુજરાતી' },
];

const CHIP = 'inline-block rounded-chip px-3 py-1 text-caption font-bold';
const ROW =
  'flex min-h-target items-center justify-between gap-3 border-t border-neutral-200 text-body';

/** The signed-in person (or the acting one) for the avatar's name. */
const shownName = (user: Me) => user.actingPerson?.name ?? user.name;

function Avatar({ size }: { size: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-text"
      style={{ width: size, height: size }}
    >
      <UserRound aria-hidden size={size / 2} />
    </span>
  );
}

/** The person button: right of the top bar on a phone, the name at the foot of the left menu on desktop. */
export function AccountButton({ onClick, named }: { onClick: () => void; named?: boolean }) {
  const { t } = useTranslation();
  const user = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user;
  usePushBinding(user?.actingPersonId || undefined);
  if (!user) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('account.aria')}
      className={
        named
          ? 'flex min-h-target w-full items-center gap-3 rounded-xl px-3 text-footnote font-medium text-neutral-900'
          : 'flex min-h-target-min min-w-target-min items-center justify-center rounded-full bg-accent-tint text-accent-text'
      }
    >
      <UserRound aria-hidden size={20} />
      {named ? <span className="truncate">{shownName(user)}</span> : null}
    </button>
  );
}

/** The person button's row on the floor's header: right-aligned, kept out of faces/ (D20). */
export function AccountButtonRow({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <AccountButton onClick={onClick} />
    </div>
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
    <div className="flex items-center gap-3">
      <Avatar size={52} />
      <div className="min-w-0">
        <p className="truncate text-title3 font-bold">{user.shared ? user.username : user.name}</p>
        <p className="text-footnote text-neutral-600">
          {t('account.signedInAs', { username: user.username, company })}
        </p>
        <span
          className={`mt-2 ${CHIP} ${grant || !user.shared ? 'bg-info-tint text-info-ink' : 'bg-muted-tint text-muted-ink'}`}
        >
          {chip}
        </span>
      </div>
    </div>
  );
}

function LanguageChoice() {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-footnote font-semibold text-neutral-600">{t('account.language')}</span>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1">
        {LANGUAGES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={i18n.language === id}
            onClick={() => void chooseLanguage(id)}
            className="min-h-target-min rounded-lg text-body font-semibold aria-pressed:bg-surface aria-pressed:text-accent-text aria-pressed:shadow-sm"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One navigation row in the sheet: the same shape as Change password. */
function NavRow({ to, icon: Icon, label }: { to: string; icon: IconComponent; label: string }) {
  return (
    <Link to={to} className={ROW}>
      <span className="flex items-center gap-3">
        <Icon aria-hidden size={20} />
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
        <div role="note" className="flex gap-2 rounded-xl bg-info-tint p-4 text-info-ink">
          <ShieldCheck aria-hidden size={20} className="mt-0.5 shrink-0" />
          <div className="flex flex-col gap-1 text-footnote text-neutral-900">
            <b className="text-body text-info-ink">{t('account.support.title')}</b>
            {t('account.support.body', { company })}
          </div>
        </div>
      ) : null}
      {user.shared ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 p-4">
          <p className="text-footnote text-neutral-600">{t('account.actingNow')}</p>
          <p className="text-title3 font-bold">{shownName(user)}</p>
          <Button variant="tonal" onClick={askWhoIsActing}>
            <span className="inline-flex items-center justify-center gap-2">
              <ArrowRightLeft aria-hidden size={20} />
              {t('account.changePerson')}
            </span>
          </Button>
          <p className="text-footnote text-neutral-600">{t('account.actingNote')}</p>
        </div>
      ) : null}
      {onDesk ? <NavRow to="/floor" icon={CirclePlus} label={t('account.floor')} /> : null}
      {!onDesk && mayOpenDesk(user.role) ? (
        <NavRow to="/desk" icon={Menu} label={t('account.desk')} />
      ) : null}
      {GUJARATI_ON ? <LanguageChoice /> : null}
      <AlertsCard personId={user.actingPersonId || undefined} />
      {grant ? null : <NavRow to="/password" icon={KeyRound} label={t('account.changePassword')} />}
      <button
        type="button"
        onClick={onSignOut}
        className="flex min-h-target items-center justify-center gap-2 rounded-xl border border-danger-ink text-body font-semibold text-danger-ink"
      >
        <LogOut aria-hidden size={20} />
        {t('account.signOut')}
      </button>
    </>
  );
}

/** The one sign-out question: the account sheet and the who step both ask it before ending the session. */
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
      <p className="text-footnote text-neutral-600">{t('account.signOutBody')}</p>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onCancel}>
          {t('account.goBack')}
        </Button>
        <Button onClick={onConfirm}>{t('account.signOut')}</Button>
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

/** The same question on a sheet of its own: the who step's back button has no account sheet to ask in. */
export function SignOutSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  async function signOutNow(): Promise<void> {
    await leaveThisPhone();
    navigate('/login');
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('account.signOutTitle')}>
      <SignOutPrompt onCancel={() => onOpenChange(false)} onConfirm={() => void signOutNow()} />
    </Sheet>
  );
}

/** The account sheet (slice 5): a bottom sheet on a phone, a side panel on desktop. Sign out asks first. */
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
    <Sheet
      open={open}
      onOpenChange={close}
      title={confirming ? t('account.signOutTitle') : t('account.title')}
    >
      {confirming ? (
        <SignOutPrompt onCancel={() => setConfirming(false)} onConfirm={() => void signOutNow()} />
      ) : (
        <Body user={user} onSignOut={() => setConfirming(true)} />
      )}
    </Sheet>
  );
}
