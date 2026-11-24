# 0029 — A figures read sends a body built once per kept run

**Date:** 2026-11-24 · **By:** Plan (Nimish away, ADR 0012) · **Amends:** ADR 0024 (G3.2 proof)

## Why

Ticket 607's load script failed G3.2: 30 readers, five years of invented history, p95 **4449 ms** against the 300 ms limit. There were 0 engine runs inside a read and 0 errors, so ticket 606's warm path works. Plan measured where the time goes (CPU profile plus timed SQL, 24 Nov):

- The figures reply is **12.6 MB** of JSON (five years, 6,750 breakdowns). About 8.5 MB of it is page tables that carry every row (`a10-problems`, `data-checklist`, `breakdown-log`). The rest is the 6,750 drill ids, repeated on most figures.
- Every read pulled the whole 13 MB jsonb out of `kpi_snapshot` (~100 ms in Postgres), let `pg` parse it (~21 ms of Node), then had Fastify stringify it again (~27 ms) and write it (~24 ms). The data stamp itself is cheap (~8 ms).
- The load script's own `fetch` readers run in the server's Node process. Their decoding (undici streams, buffer copies, gunzip) used more of that process's CPU than the server did.

A throwaway spike (not committed) proved the fix. Each read checks only the kept row's `run_id` and the stamp, then sends a gzipped body built once and held in memory. Readers use `node:http`, ask for gzip and drain the body without decoding it. Result: **p95 196 ms** (p50 134 ms, 4,274 requests in 20 s, 0 errors, 0 engine runs). Control runs: the reader change alone gave p95 4,315 ms, and the server change alone gave 714 ms. Both changes are needed. The limit stays 300 ms.

## Decisions

1. **Built body (ticket 628).** `GET /analytics/figures` reads the kept row's `run_id` (a fresh UUID on every keep; it does not detoast the value) and the data stamp. For (plant, date, money view, run_id) the process holds one body: the exact reply JSON as before, gzipped once. Only a body not yet held reads the kept value, and concurrent readers build it once. At most 32 bodies are held, least recently used dropped. The stamp check, the warm job and the cold miss stay exactly as in ADR 0024.
2. **ETag / 304.** ETag `"<run_id>.m"` (money shown) or `"<run_id>.p"` (money hidden). `If-None-Match` naming it gets 304 with no body. Headers: `cache-control: private, no-cache`, `vary: accept-encoding`. Browsers then revalidate on their own and a repeat screen load moves no body. The web client needs no change.
3. **Plain JSON when gzip is not accepted.** Same bytes, unzipped. Nothing else about the contract changes.
4. **The load script measures the server, not its own client (amends ticket 607's readers).** Readers send `accept-encoding: gzip` with `node:http` and drain the body without decoding it. A browser decodes on its own device, so that cost was never the server's. One warm-up read still decodes and parses the JSON to prove the body is real figures. This is not a looser limit: p95 is still timed from send to last byte.
5. **Ticket 607 merges as it is.** The script, its test and its "Blocked" handoff are correct work: the ticket said to stop and report if p95 was over. G3.2 stays unticked. Ticket 628 is blocked by 607 because it edits `tools/load-figures.ts`. G3.2 is ticked only after 628 merges and a full `pnpm load:figures` run (30 readers, 60 s, 5 years) shows p95 ≤ 300 ms.
6. **Seams tested** (unattended, so recorded here rather than agreed with Nimish): the HTTP route (`app.inject`: encodings, ETag, 304, money views, plants, stale and warm) and a process counter `bodiesBuilt()`, the same pattern as `engineRunsInRead()`.

## Consequences

- **Open risk, not fixed here:** the decoded reply is still 12.6 MB for five years. On a plant-floor phone that is a slow first load (download about 1–2 MB gzipped, then parse 12.6 MB). Trimming page tables and drill ids out of the figures reply is a contract change across server and web screens. It is a candidate M3 ticket after 628, not part of G3.2.
- Memory: at most 32 gzipped bodies in each server process (about 1–2 MB each at five years).
- A gzipped Buffer skips the `CHECK_REPLIES` onSend contract check (that check only parses string payloads). The hidden tests parse the decoded body against `REPLY_SCHEMAS` for money and non-money readers instead.
- Production goes through Caddy (`reverse_proxy`, no `encode`), so the gzip and the 304 reach the browser unchanged.
