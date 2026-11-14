/**
 * The offline outbox (SPEC 1.9): commands that may leave the phone without a connection are kept
 * in IndexedDB with their Idempotency-Key until replay succeeds, or become drafts on a conflict.
 *
 * Raw IndexedDB, no dependency. Only the four offline-writable commands queue:
 * `close` (report / no_report / done) and `report` (late report).
 */
import type { CommandAction, CommandBody } from '../api.js';
import { currentWho, isMine, type Who } from '../data/index.js';
import { cachedTicketRef } from './cache.js';

const DB_NAME = 'uptimo-offline';
const DB_VERSION = 1;
const QUEUE_STORE = 'queue';
const DRAFTS_STORE = 'drafts';

export type QueueableAction = 'close' | 'report';

export interface QueueEntry {
  id: string;
  action: QueueableAction;
  ticketId: string;
  ref: string;
  body: CommandBody;
  idempotencyKey: string;
  at: string;
  createdAt: string;
  /** Who made it (login and acting person); replay sends it only as them. Missing on older entries. */
  who?: Who;
}

export interface DraftEntry extends QueueEntry {
  reason: string;
  /** A copy key shown instead of the server's reason (e.g. the permanent 403 refusal). */
  reasonKey?: string;
  status: 'draft';
}

export interface QueueInput {
  action: QueueableAction;
  ticketId: string;
  ref?: string;
  body: CommandBody;
  idempotencyKey: string;
  at?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
          db.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
    });
  }
  return dbPromise;
}

function runRequest<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const request = run(transaction.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
      }),
  );
}

function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function byCreatedAt(a: QueueEntry, b: QueueEntry): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

/** Only the offline-writable commands; every other command needs a connection. */
export function isQueueable(action: CommandAction): action is QueueableAction {
  return action === 'close' || action === 'report';
}

/** Queue one command with the body the client built, its fresh Idempotency-Key and its time. */
export async function enqueue(input: QueueInput): Promise<QueueEntry> {
  const now = new Date().toISOString();
  const entry: QueueEntry = {
    id: newId(),
    action: input.action,
    ticketId: input.ticketId,
    ref: input.ref ?? cachedTicketRef(input.ticketId) ?? input.ticketId,
    body: input.body,
    idempotencyKey: input.idempotencyKey,
    at: input.at ?? now,
    createdAt: now,
    who: currentWho() ?? undefined,
  };
  await runRequest(QUEUE_STORE, 'readwrite', (store) => store.add(entry));
  return entry;
}

/** The queued commands in the order they were made. */
export async function listQueued(): Promise<QueueEntry[]> {
  const entries = await runRequest<QueueEntry[]>(QUEUE_STORE, 'readonly', (store) =>
    store.getAll(),
  );
  return entries.sort(byCreatedAt);
}

/** How many commands are waiting to replay (the offline banner reads this). */
export async function queueLength(): Promise<number> {
  return (await listQueued()).length;
}

/** The queue split by owner: this phone's current person, and who else queued what is held ('' = unknown). */
export async function queueByOwner(): Promise<{ mine: number; heldBy: string[] }> {
  const now = currentWho();
  const entries = await listQueued();
  const held = entries.filter((entry) => !isMine(entry.who, now));
  return {
    mine: entries.length - held.length,
    heldBy: [...new Set(held.map((entry) => entry.who?.name ?? ''))],
  };
}

export async function removeQueued(id: string): Promise<void> {
  await runRequest(QUEUE_STORE, 'readwrite', (store) => store.delete(id));
}

/** A queued command the server refused (409, or 403 for someone else's): the person sees it and can retry or dismiss it. */
export async function addDraft(
  entry: QueueEntry,
  reason: string,
  reasonKey?: string,
): Promise<DraftEntry> {
  const draft: DraftEntry = {
    ...entry,
    reason,
    ...(reasonKey ? { reasonKey } : {}),
    status: 'draft',
  };
  await runRequest(DRAFTS_STORE, 'readwrite', (store) => store.put(draft));
  return draft;
}

export async function listDrafts(): Promise<DraftEntry[]> {
  const drafts = await runRequest<DraftEntry[]>(DRAFTS_STORE, 'readonly', (store) =>
    store.getAll(),
  );
  return drafts.sort(byCreatedAt);
}

export async function removeDraft(id: string): Promise<void> {
  await runRequest(DRAFTS_STORE, 'readwrite', (store) => store.delete(id));
}
