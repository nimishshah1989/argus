/** The connection to the server was lost (and nothing cached stands in): the screen says "offline", not "error". */
export class LiveOffline extends Error {
  constructor() {
    super('offline');
    this.name = 'LiveOffline';
  }
}
