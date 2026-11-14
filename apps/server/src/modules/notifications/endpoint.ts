import { parse as legacyParse } from 'node:url';

/**
 * The only places a push subscription may point at: the browsers' own push services. The server POSTs to
 * whatever address a subscription names, so anything else would let a caller aim it at an internal host.
 * `web-push` does not follow redirects (a 3xx counts as a failure), so a listed host cannot bounce us.
 *
 * `web-push` connects using Node's legacy `url.parse`, which reads some strings differently from
 * `new URL` (`https://localhost%2e.push.apple.com/` is host `localhost` to one and a push.apple.com name
 * to the other). So an address is accepted only if both parsers give the same listed host.
 */
const EXACT_HOSTS = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com']);
const HOST_SUFFIXES = ['.push.apple.com', '.notify.windows.com'];

function listed(hostname: string): boolean {
  // An IP literal never ends in one of these names, so it cannot pass.
  return EXACT_HOSTS.has(hostname) || HOST_SUFFIXES.some((s) => hostname.endsWith(s));
}

/** Whitespace, control characters and backslashes: parsers disagree about what they mean. */
function hasOddCharacters(endpoint: string): boolean {
  if (/[\s\\]/.test(endpoint)) return true;
  return [...endpoint].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f);
}

export function isPushEndpoint(endpoint: string): boolean {
  if (hasOddCharacters(endpoint)) return false;
  // Exactly `https://`, then a host with no percent-escapes (`https:/host` would mean localhost).
  const authority = /^https:\/\/([^/?#]*)/i.exec(endpoint)?.[1];
  if (authority === undefined || authority.includes('%')) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return false;
  if (url.port !== '' && url.port !== '443') return false;
  return listed(url.hostname) && legacyParse(endpoint).hostname === url.hostname;
}

/** The single spelling we store and send for an address `isPushEndpoint` accepted. */
export function normalisedEndpoint(endpoint: string): string {
  return new URL(endpoint).href;
}
