/**
 * Where a replayed ticket differs from what his `worker.js` computed, and why. The replay test fails on a difference
 * that is not listed here and on a listed one that no longer happens. Key: the line the test prints.
 */
export const EXPECTED_DIFFS: Record<string, string> = {
  // Closed 29 Oct, before his app wrote `segment` rows: his hands-on is 0 and the one person's minutes are 0 although the
  // ticket ran 115 minutes from start to close. Our figure follows the work segment, 115. He stored 0 and the importer keeps it.
  'BD-0023 activeMin: his 0, ours 115': 'closed before his app wrote segment rows (stored 0)',
  'BD-0023 minutes of Person 20: his 0, ours 115':
    'closed before his app wrote segment rows (stored 0)',
  // The export holds a join by the person who is running the job (4 Nov). worker.js today refuses it ("already running this job");
  // we refuse it too (409), so the replay cannot add the one minute that join earned him.
  'WR-0051 refused: join 409 Already running this job':
    'the current worker.js and ours refuse a join by the person running the job',
  'WR-0051 minutes of Person 28: his 19, ours 18':
    'follows from the refused join above (his extra minute is the support clock of that join)',
};

/** Tickets the replay does not run, and why. */
export const NOT_REPLAYED: Record<string, string> = {
  'BD-0077':
    'cancelled and restored: our restore reopens a stretch only for a working ticket and the cancelled gap rule is still with Nimish (DOMAIN §5)',
};
// A ticket with no `down` event (16 legacy rows: only a `report` event, or none) has no steps to replay.

/**
 * CANCEL_RULE: on a cancelled ticket his app writes no segment row for the stretch open at the cancel, so his hands-on and
 * per-person minutes leave that stretch out. Our cancel closes the stretch and keeps the minutes as the person's own.
 * The replay does not compare those two quantities on a cancelled ticket; cancel is not part of this ticket (18/20).
 */
export const CANCEL_RULE = 'the minutes open at a cancel';
