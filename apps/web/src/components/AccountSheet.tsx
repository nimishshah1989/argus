import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { clearToken, getMe } from '../api.js';

const ROLE_KEYS: Record<string, string> = {
  operator: 'account.role.operator',
  technician: 'account.role.technician',
  supervisor: 'account.role.supervisor',
  head: 'account.role.head',
  plant_head: 'account.role.plantHead',
  admin: 'account.role.admin',
  board: 'account.role.board',
};

const detailRow =
  'flex justify-between gap-3 border-b border-neutral-100 py-2 text-sm last:border-0';

/** Who am I, the acting person, and Sign out — a small panel opened from the desk header. */
export function AccountSheet() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const [open, setOpen] = useState(false);
  const user = me.data?.user;
  if (!user) return null;

  function signOut() {
    clearToken();
    navigate('/login');
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={t('account.aria')}
        className="inline-flex min-h-13 max-w-40 items-center truncate rounded-xl border border-neutral-300 bg-white px-4 text-base font-semibold text-neutral-900 hover:bg-neutral-100"
      >
        {user.name}
      </button>
      {open && (
        <section
          aria-label={t('account.title')}
          className="absolute right-0 z-10 mt-2 w-72 rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg"
        >
          <p className="text-lg font-semibold tracking-tight">{user.name}</p>
          {user.title && <p className="text-sm text-neutral-600">{user.title}</p>}
          <div className="mt-3">
            <p className={detailRow}>
              <span className="text-neutral-500">{t('account.role')}</span>
              <span className="font-medium">{t(ROLE_KEYS[user.role] ?? user.role)}</span>
            </p>
            <p className={detailRow}>
              <span className="text-neutral-500">{t('account.actingAs')}</span>
              <span className="font-medium">{user.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="mt-4 min-h-13 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base font-semibold text-neutral-900 hover:bg-neutral-100"
          >
            {t('account.signOut')}
          </button>
        </section>
      )}
    </div>
  );
}
