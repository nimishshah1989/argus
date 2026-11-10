import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getConfig } from '../api.js';
import { MyComplaints } from './floor/MyComplaints.js';
import { ReportForm } from './floor/ReportForm.js';
import { SentConfirmation } from './floor/SentConfirmation.js';

const navLink = 'inline-flex min-h-13 items-center rounded-lg px-4 font-medium';

export function Floor() {
  const { t } = useTranslation();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const [sentRef, setSentRef] = useState('');

  if (sentRef) return <SentConfirmation sentRef={sentRef} onAnother={() => setSentRef('')} />;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <nav className="mb-6 flex gap-2">
        <Link to="/floor" className={`${navLink} bg-neutral-200 text-neutral-900`}>
          {t('nav.report')}
        </Link>
        <Link to="/desk" className={`${navLink} text-neutral-600 hover:bg-neutral-200`}>
          {t('nav.desk')}
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold">{t('floor.title')}</h1>
      <ReportForm config={config.data} onSent={setSentRef} />
      <MyComplaints machines={config.data?.machines ?? []} />
    </main>
  );
}
