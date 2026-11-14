const WINDOW_MS = 5 * 60 * 1000;
const PER_NAME = 20; // attempts per sender and username
const MAX_KEYS = 20_000;

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Limits password guessing for one account from one address: a determined attacker gets about 20 guesses
 * per name per 5 minutes. There is deliberately no limit over all names from one address: the whole plant
 * shares one address, so one person's spraying would lock every phone out. Spraying across names is
 * bounded by the route's own request cap and by the cost of each password check.
 *
 * Every attempt is counted when it starts, so a burst of parallel guesses cannot slip past; a correct
 * password gives its attempt back, so a shift signing in on one shared login never uses the allowance up.
 * In memory: the API is one process (D18).
 */
export function createLoginGuard(now: () => number = Date.now, maxKeys: number = MAX_KEYS) {
  const buckets = new Map<string, Bucket>();
  const keyOf = (ip: string, tenantId: string, username: string) =>
    `${ip}|${tenantId}|${username.toLowerCase()}`;

  /** Makes room for one more name. Locked names are never evicted; false if nothing else can go. */
  function makeRoom(): boolean {
    if (buckets.size < maxKeys) return true;
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now()) buckets.delete(key);
    // Oldest first, and only names that still have attempts left.
    for (const [key, bucket] of buckets) {
      if (buckets.size < maxKeys) break;
      if (bucket.count < PER_NAME) buckets.delete(key);
    }
    return buckets.size < maxKeys;
  }

  const wait = (bucket: Bucket) => Math.ceil((bucket.resetAt - now()) / 1000);

  return {
    /** Seconds to wait if this sender may not try this name now, otherwise 0 after counting the attempt. */
    take(ip: string, tenantId: string, username: string): number {
      const key = keyOf(ip, tenantId, username);
      const existing = buckets.get(key);
      if (existing && existing.resetAt > now()) {
        if (existing.count >= PER_NAME) return wait(existing); // blocked: nothing new is created
        existing.count += 1;
        return 0;
      }
      buckets.delete(key);
      // No room and nothing to evict: refuse rather than track a new name by forgetting a locked one.
      if (!makeRoom()) return Math.ceil(WINDOW_MS / 1000);
      buckets.set(key, { count: 1, resetAt: now() + WINDOW_MS });
      return 0;
    },
    /** The password was right: this attempt does not count against the sender. */
    refund(ip: string, tenantId: string, username: string): void {
      const bucket = buckets.get(keyOf(ip, tenantId, username));
      if (bucket && bucket.count > 0) bucket.count -= 1;
    },
  };
}
