/** Thrown when the render queue is full; the route answers 503 with Retry-After. */
export class RenderBusyError extends Error {
  constructor() {
    super('Too many reports are being made right now');
  }
}

/**
 * Runs at most `concurrency` jobs at once, lets `queue` more wait their turn, and refuses the rest.
 * Each PDF is a whole Chromium (hundreds of MB, a few seconds of CPU); the server is one small machine.
 */
export function createRenderGate(
  concurrency: number,
  queue: number,
): <T>(job: () => Promise<T>) => Promise<T> {
  let running = 0;
  const waiting: Array<() => void> = [];
  return async function run<T>(job: () => Promise<T>): Promise<T> {
    if (running < concurrency) {
      running += 1;
    } else if (waiting.length < queue) {
      // The finishing job hands its slot straight to us, so `running` stays as it is.
      await new Promise<void>((resolve) => waiting.push(resolve));
    } else {
      throw new RenderBusyError();
    }
    try {
      return await job();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else running -= 1;
    }
  };
}
