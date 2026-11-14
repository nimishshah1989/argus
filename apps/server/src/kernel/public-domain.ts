/**
 * The public domain the plants' addresses sit under (a plant is `<slug>.<domain>`), from PUBLIC_BASE_DOMAIN: a bare
 * host name (not an IP address), no scheme, path or port. Unset means links to the app are not built; a malformed value stops the start,
 * because a wrong one would put wrong addresses on printed QR codes.
 */
export function publicBaseDomainFromEnv(
  env: Record<string, string | undefined>,
): string | undefined {
  const raw = env.PUBLIC_BASE_DOMAIN?.trim().toLowerCase();
  if (!raw) return undefined;
  const bare = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(raw) && !raw.includes('..');
  if (!bare || /^\d+(\.\d+){3}$/.test(raw)) {
    throw new Error('PUBLIC_BASE_DOMAIN must be a bare host name such as plants.example.com');
  }
  return raw;
}
