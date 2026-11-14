import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { shareText, waMeUrl, type ShareMode } from '../../../../packages/shared/src/share.js';
import { getBrand, type Config, type Ticket } from '../api.js';

interface Props {
  ticket: Ticket;
  config?: Config;
  mode?: ShareMode;
}

/**
 * Opens WhatsApp with the ticket text. The text is the tested shared function; the brand lookup
 * supplies the tenant name for the full text (the config payload does not carry it yet).
 * A link that looks like the kit's secondary button.
 */
export function ShareButton({ ticket, config, mode = 'short' }: Props) {
  const { t } = useTranslation();
  const brand = useQuery({
    queryKey: ['brand'],
    queryFn: getBrand,
    staleTime: Infinity,
    retry: false,
  });
  const href = waMeUrl(shareText(ticket, { ...config, tenantName: brand.data?.company }, mode));
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-target w-full items-center justify-center rounded-xl border border-control bg-surface px-4 text-body font-semibold text-neutral-900"
    >
      {t('share.send')}
    </a>
  );
}
