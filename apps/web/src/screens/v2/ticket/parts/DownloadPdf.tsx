import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getToken, type Ticket } from '../../../../api.js';
import { Button } from '../../../../ui/v2/button.js';
import { Notice } from '../../../../ui/v2/notice.js';

/** The ticket's PDF (issue 803) with the sign-in token, saved as a file; false when it could not be fetched. */
export async function downloadTicketPdf(ticket: Pick<Ticket, 'id' | 'ref'>): Promise<boolean> {
  const token = getToken();
  try {
    const res = await fetch(`/api/v1/tickets/${encodeURIComponent(ticket.id)}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return false;
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `${ticket.ref ?? ticket.id}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

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
