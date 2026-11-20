/** The connection to the server was lost (and nothing cached stands in): the screen says "offline", not "error". */
export class LiveOffline extends Error {
  constructor() {
    super('offline');
    this.name = 'LiveOffline';
  }
}

/** A fetch that never reached the server (the browser throws a `TypeError` for it); a refusal or an unreadable reply is not. */
export const isLostConnection = (error: unknown): boolean => error instanceof TypeError;

/** The engine has not computed this figure yet: a screen says so, which is not the same as "nothing to show". */
export class NotComputed extends Error {
  constructor() {
    super('not computed');
    this.name = 'NotComputed';
  }
}
