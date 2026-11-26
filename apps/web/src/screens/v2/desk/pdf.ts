import { getToken } from '../../../api.js';

/**
 * A PDF the server makes (the day report, a ticket's report), fetched with the sign-in token and saved as `file`;
 * false when it could not be fetched. The one raw fetch of the desk: a PDF is a blob, not a JSON resource.
 */
export async function downloadPdf(href: string, file: string): Promise<boolean> {
  const token = getToken();
  try {
    const res = await fetch(href, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return false;
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = file;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
