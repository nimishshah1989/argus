import { useTranslation } from 'react-i18next';
import { workbookBytes, type Sheet } from '@uptimo/shared/xlsx';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Saves the workbook in the browser (ticket 732, ADR 0041): a Blob of `workbookBytes(sheets, docRef)` typed
 * `XLSX_TYPE`, an object URL, a temporary `<a>` with `href` = that URL and `download` = `<file>.xlsx`, appended to
 * `document.body`, clicked, removed, then the URL revoked. `DownloadExcel`'s button calls this.
 */
export function saveWorkbook(file: string, sheets: Sheet[], docRef?: string): void {
  void [file, sheets, docRef, XLSX_TYPE];
  throw new Error('not implemented');
}

/**
 * "Download Excel" for a table or page (ADR 0036 R6): builds the .xlsx in the browser from exact values
 * (the page rounds, the file never does) with the page's DOC. NO. on the first row of every sheet.
 */
export function DownloadExcel({
  file,
  sheets,
  docRef,
}: {
  /** File name without the extension. */
  file: string;
  sheets: Sheet[];
  docRef?: string;
}) {
  const { t } = useTranslation();
  const save = () => {
    const url = URL.createObjectURL(new Blob([workbookBytes(sheets, docRef)], { type: XLSX_TYPE }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${file}.xlsx`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <button type="button" className="v2-btn" onClick={save}>
      {t('insight.excel')}
    </button>
  );
}
