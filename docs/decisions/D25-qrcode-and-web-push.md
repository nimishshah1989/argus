# D25 — Two runtime dependencies: `qrcode` and `web-push`

Date: 13 November 2026 · Status: accepted (M0 audit); records dependencies already in `apps/server/package.json` and `THIRD_PARTY.md`

## Decision

- **`qrcode`** 1.5.x (MIT): draws the QR code on a ticket's PDF so a printed sheet opens the ticket on a phone (`modules/reports/pdf.ts`).
- **`web-push`** 3.6.x (MPL-2.0): sends a push to a phone. It does the VAPID signing and the payload encryption the push services require (RFC 8291 and RFC 8292).

## Why

Both do one job we should not write ourselves. Encrypting push payloads and signing VAPID tokens by hand is easy to get subtly wrong, and a QR encoder is a long, fiddly table. Each is a single-purpose package; each is used in one module.

MPL-2.0 is a file-level licence: we use the package unmodified, so nothing of ours is covered by it. It is on the licence allowlist (`pnpm licences`).

## Guard on use

`web-push` POSTs to whatever address a subscription names, so a subscription may only name a real push service over https (`notifications/endpoint.ts`). It does not follow redirects.

## Rejected

- Hand-written VAPID and payload encryption: security-critical code with a mature library available.
- A hosted push service: a new outside service and cost for one feature (ADR 0002 keeps that list short).
- Drawing the QR in the browser: the PDF is built on the server.
