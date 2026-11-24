/* eslint-disable @typescript-eslint/no-unused-vars -- skeleton: the builder fills the body and deletes this line */
import type { Sheet } from '@uptimo/shared/xlsx';

/**
 * "Download Excel" for a table or page (ADR 0036 R6): a `<button type="button" class="v2-btn">` labelled
 * `t('insight.excel')`. On click: `workbookBytes(sheets, docRef)` → a `Blob` of type
 * `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` → an object URL on a temporary
 * `<a download="<file>.xlsx">` that is clicked, removed and its URL revoked (as `cell-change-log/save-text.ts`).
 * `docRef` comes from `DOC_REF` in `@uptimo/shared/doc-ref`; values stay exact (the page rounds, the file never does).
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
  throw new Error('not implemented');
}
