# 74 — the restore drill no longer crashes a test run when it drops its scratch database

- Dropping the scratch database with FORCE could end a connection that was still closing; the pool had no error
  listener, so Node treated it as an unhandled error and failed the whole API test run although every test passed.
  Both drill pools now listen for idle-client errors; a failing query still throws as before.
- Nothing a user sees changes.
