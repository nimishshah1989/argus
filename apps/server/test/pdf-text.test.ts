import { describe, expect, it } from 'vitest';
import { renderPdf } from '../src/modules/reports/pdf.js';
import { pdfShows } from './pdf-text.js';

const GUJARATI = 'સ્પિન્ડલ બેરિંગ બદલવું પડ્યું';
const page = (body: string): string =>
  `<html><head><meta charset="utf-8"></head><body style="font-family:'Noto Sans Gujarati',sans-serif">${body}</body></html>`;

// The helper the report tests lean on: it must say yes for text that is drawn and no for text that is not.
describe('reading Gujarati back out of a PDF', () => {
  it('finds every Gujarati letter that was drawn', async () => {
    expect(pdfShows(await renderPdf(page(`${GUJARATI} Hello`)), GUJARATI)).toBe(true);
  });

  it('says no for letters that were never drawn', async () => {
    expect(pdfShows(await renderPdf(page('Hello only')), GUJARATI)).toBe(false);
  });
});
