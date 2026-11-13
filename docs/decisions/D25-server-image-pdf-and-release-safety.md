# D25 — Server image runs PDFs as a non-root user; releases snapshot before migrating

Date: 13 November 2026 · Status: proposed (M0 audit fixes; the orchestrator confirms at merge)

## Decision

- The server image installs Alpine's `chromium` plus the Noto Gujarati, Devanagari and Latin fonts and sets
  `CHROMIUM_PATH=/usr/bin/chromium`. No browser is downloaded at runtime. It runs as the image's `node` user.
- Chromium keeps `--no-sandbox`. Its own sandbox needs user namespaces, which Docker's default seccomp profile blocks;
  enabling it would mean loosening the container for the whole server. What Chromium opens is our own template (every value
  escaped, no script, no network), in a non-root container.
- A PDF is made when asked for and sent as bytes. Nothing is stored (no file, no `file` row). One render runs at a time, three
  wait, the next caller gets 503 with `Retry-After: 5` (error code `rate_limited`).
- `deploy.sh` snapshots RDS (`uptimo-pre-<tag>-<time>`) and waits before any migration run that has files pending. After a
  release fails its checks, the old code is started again, and if the database was already migrated the log says it
  and names the snapshot. A release that cannot make a PDF in the running container counts as failed.

## Rejected

- Chromium's sandbox on (`SYS_ADMIN` or a custom seccomp profile): a wider hole than the one it closes, for HTML we wrote.
- Keeping the file rows and an S3 adapter for PDFs: a report is cheap to remake, and the numbers it holds are in the database.
- Leaving a migrated release running when its health check fails: it is down for certain; the old code on an additive schema is
  usually up.
- Playwright's browser download at runtime: slow, unpinned, needs the network at start.

## Cost if wrong

- Alpine packages move with the base image (`node:24-alpine`); the build's package check and the post-deploy PDF check say so.
- Rolling back over a destructive migration leaves the old code broken: restore the named snapshot (`infra/RESTORE.md`).
- Four people printing at once means two of them tap again; raise the queue in `pdf.ts` if that is too tight.
