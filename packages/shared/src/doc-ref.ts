/**
 * Bhavin's controlled-form document numbers, by page (ADR 0036 R6; his platform's `PAGE_DOC_REF`). A page's
 * Excel download writes its number on the first row of every sheet: `DOC. NO. <ref>`. Pages not listed have none.
 */
export const DOC_REF = {
  /** List of Machinery and Utilities: every register page. */
  machines: 'CE-MTN-F-01',
  robots: 'CE-MTN-F-01',
  conv: 'CE-MTN-F-01',
  proc: 'CE-MTN-F-01',
  util: 'CE-MTN-F-01',
  dg: 'CE-MTN-F-01',
  /** Breakdown History. */
  breakdowns: 'CE-MTN-F-04',
  /** Preventive maintenance plan. */
  pm: 'CE-MTN-F-02',
} as const;

export type DocPage = keyof typeof DOC_REF;
