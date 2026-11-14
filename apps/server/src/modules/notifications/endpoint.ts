/**
 * The only places a push subscription may point at: the browsers' own push services. The server POSTs to
 * whatever address a subscription names, so anything else would let a caller aim it at an internal host.
 * `web-push` does not follow redirects (a 3xx counts as a failure), so a listed host cannot bounce us.
 */
const EXACT_HOSTS = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com']);
const HOST_SUFFIXES = ['.push.apple.com', '.notify.windows.com'];

export function isPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return false;
  if (url.port !== '' && url.port !== '443') return false;
  // An IP literal never ends in one of these names, so it cannot pass.
  return EXACT_HOSTS.has(url.hostname) || HOST_SUFFIXES.some((s) => url.hostname.endsWith(s));
}
