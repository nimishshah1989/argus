import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { closeSync, openSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

/** Plumbs the child processes and containers the e2e stack starts and stops. */

export interface LoggedProcessOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  logFile: string;
}

/** Starts `node <args>` detached (so the whole process group can be killed) with logs on disk. */
export function spawnLogged(args: string[], options: LoggedProcessOptions): ChildProcess {
  const logFd = openSync(options.logFile, 'w');
  try {
    const child = spawn(process.execPath, args, {
      cwd: options.cwd,
      env: options.env,
      detached: true,
      stdio: ['ignore', logFd, logFd],
    });
    child.unref();
    return child;
  } finally {
    closeSync(logFd);
  }
}

export function logTail(logFile: string): string {
  try {
    return readFileSync(logFile, 'utf8').split('\n').slice(-40).join('\n');
  } catch {
    return '(no log)';
  }
}

/** Polls until the URL answers 2xx; fails early if the process it depends on exited. */
export async function waitForHttp(
  url: string,
  child: ChildProcess,
  logFile: string,
): Promise<void> {
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`process exited before ${url} was ready\n${logTail(logFile)}`);
    }
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server is not listening yet.
    }
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${url}\n${logTail(logFile)}`);
    await delay(200);
  }
}

export async function assertPortFree(port: number): Promise<void> {
  if (await portInUse(port)) {
    throw new Error(
      `port ${port} is already in use; stop the running dev stack before pnpm test:e2e`,
    );
  }
}

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolvePromise(true);
    });
    socket.once('error', () => resolvePromise(false));
  });
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function signalPid(pid: number, signal: NodeJS.Signals): Promise<void> {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // Already gone.
    }
  }
}

/** SIGTERMs the whole process group, then SIGKILLs if it is still there after five seconds. */
export async function killPid(pid: number): Promise<void> {
  if (!pid || !isAlive(pid)) return;
  await signalPid(pid, 'SIGTERM');
  const deadline = Date.now() + 5_000;
  while (isAlive(pid) && Date.now() < deadline) await delay(100);
  if (isAlive(pid)) await signalPid(pid, 'SIGKILL');
}

export function removeContainer(containerId: string): void {
  if (!containerId) return;
  try {
    execFileSync('docker', ['rm', '-f', containerId], { stdio: 'ignore' });
  } catch {
    // The container (or its Ryuk reaper) already removed it.
  }
}
