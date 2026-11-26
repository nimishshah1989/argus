import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Ticket } from '../../../../api.js';
import { Button } from '../../../../ui/v2/button.js';
import { Notice } from '../../../../ui/v2/notice.js';
import { downloadPdf } from '../../desk/pdf.js';

/** The ticket's PDF (issue 803), saved as `<ref>.pdf`; false when it could not be fetched. */
export const downloadTicketPdf = (ticket: Pick<Ticket, 'id' | 'ref'>): Promise<boolean> =>
  downloadPdf(
    `/api/v1/tickets/${encodeURIComponent(ticket.id)}/pdf`,
    `${ticket.ref ?? ticket.id}.pdf`,
  );

/** "Download PDF", a quiet button; a failed download says so under it. */
export function DownloadPdfButton({ ticket }: { ticket: Pick<Ticket, 'id' | 'ref'> }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void downloadTicketPdf(ticket).then((ok) => {
            setFailed(!ok);
            setBusy(false);
          });
        }}
      >
        {t('detail.pdf')}
      </Button>
      {failed ? <Notice tone="error" title={t('detail.pdfFailed')} /> : null}
    </>
  );
}
