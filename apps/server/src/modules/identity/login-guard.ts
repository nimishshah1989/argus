const WINDOW_MS = 5 * 60 * 1000;
const PER_NAME = 10; // misses per sender and username
const PER_SENDER = 100; // misses per sender over all usernames: far above a shift behind one plant address
const MAX_KEYS = 20_000;

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Limits password guessing. Every attempt is counted when it starts, so a burst of parallel guesses
 * cannot slip past; a correct password gives its attempt back, so a shift signing in on one shared
 * login from one plant address never uses the allowance up. In memory: the API is one process (D18).
 */
export function createLoginGuard(now: () => number = Date.now) {
  const buckets = new Map<string, Bucket>();

  function open(key: string): Bucket {
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now()) {
      if (buckets.size >= MAX_KEYS) {
        for (const [k, b] of buckets) if (b.resetAt <= now()) buckets.delete(k);
        // Still full of live keys: drop the oldest rather than grow without bound.
        for (const k of buckets.keys()) {
          if (buckets.size < MAX_KEYS) break;
          buckets.delete(k);
        }
      }
      bucket = { count: 0, resetAt: now() + WINDOW_MS };
      buckets.set(key, bucket);
    }
    return bucket;
  }

  const keys = (ip: string, tenantId: string, username: string) =>
    [`n|${ip}|${tenantId}|${username.toLowerCase()}`, `i|${ip}`] as const;

  return {
    /** Seconds to wait if the sender is over a limit, otherwise 0 after counting this attempt. */
    take(ip: string, tenantId: string, username: string): number {
      const [byName, bySender] = keys(ip, tenantId, username);
      const name = open(byName);
      const sender = open(bySender);
      if (name.count >= PER_NAME || sender.count >= PER_SENDER) {
        return Math.ceil((Math.max(name.resetAt, sender.resetAt) - now()) / 1000);
      }
      name.count += 1;
      sender.count += 1;
      return 0;
    },
    /** The password was right: this attempt does not count against the sender. */
    refund(ip: string, tenantId: string, username: string): void {
      for (const key of keys(ip, tenantId, username)) {
        const bucket = buckets.get(key);
        if (bucket && bucket.count > 0) bucket.count -= 1;
      }
    },
  };
}
