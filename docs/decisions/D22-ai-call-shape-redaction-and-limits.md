# D22 — AI calls: one request, retrieval in code, redaction, consent, cap

Date: 13 November 2026 · Status: proposed (architect); needs the architecture and schema reviews. Builds on D16 and ADR 0007.

## Decision

1. **One request per suggestion.** `AiProvider.complete({ task, input, outputSchema }) → { output, usage, modelRef }` is unchanged. The model gets no tools and cannot ask for more data.
2. **Retrieval is code.** The `ai.suggest` handler reads through published functions, then builds the prompt:
   - `tickets.readTicket(tx, id)` for the subject.
   - `tickets.search(tx, { text, machineId?, limit })` for similar past jobs.
   - `tickets.machineHistory(tx, { machineId, before, limit })` for that machine's closed tickets, newest first (new published read).
   - `identity.redactionTerms(tx)` for the words to remove (new published read).
3. **Tenant comes only from the job payload.** Every read runs in `withTenant(pool, payload.tenantId, …)`. No transaction is open while the provider is called.
4. **Evidence is checked twice.** A cited ticket id that was not in this call's candidates is dropped. The rest are re-read with `tickets.refsByIds(tx, ids)` under `withTenant`; an id the tenant cannot see is dropped. A candidate left with no evidence is marked a guess by code.
5. **Redaction.** `identity.redactionTerms(tx) → { names, phones, usernames }` covers active and former people. Each term, and any phone-shaped number, becomes a placeholder (`[P1]`). The map lives in memory for that call. It is never stored, logged or sent. Placeholders are not turned back into names; one left in the output is shown as "a colleague". Before sending, code scans the final prompt for every term. A hit stops the call (`redaction_failed`).
6. **Text only.** `input` has no image field. No photo, scanned page or PDF image goes to the provider. A feature that needs one waits for a crop-and-redact step and its own decision.
7. **Consent.** The plant's setting `ai.consent` holds `{ status, signedOn, fileId, wordingVersion, recordedByLoginId }`. Only the admin role may write it; every change is audited. No real call is made for a tenant unless `status = 'granted'`. Withdrawal takes effect on the next job.
8. **Spend.** Each call's tokens and cost are added to its `ai_suggestion` row. Cost is computed in code from `usage` and a price table kept in configuration beside the model id. The plant's setting `ai.monthlyCapUsd` is the cap. Before a call, code sums the tenant's cost for the UTC month and adds the largest this call can cost. Over the cap means no call. A tenant with no cap set gets no calls.
9. **Idempotency.** `ai_suggestion` is unique on `(tenant_id, feature, subject_type, subject_id, prompt_version)`. The handler claims the row before calling. A second job for the same key does nothing. A model change bumps the prompt version, because a threshold is only proven for the pair.
10. **No SDK.** The adapter uses Node's `fetch` inside `kernel.withTimeout`. Structured output uses the provider's JSON-schema output (verify in current docs; the fallback is one forced tool call whose input is the answer, still one request). The reply is always validated with `outputSchema` again.

## Diagnosis output (`diagnosisOutputV1` in `packages/shared/src/ai.ts`)

`{ v: 1, safetyFlagged, safetyReason, candidates: [{ cause, firstCheck, expectedFix, evidenceTicketIds, isGuess }] }`. At most three candidates. `safetyReason` is required when `safetyFlagged` is true. `isGuess` is set by code. The whole object is stored in `ai_suggestion.output`; `safety_flagged` is not a column, because no query filters on it. The fixed lockout line on the screen comes from the app, not from the model. Confirming a diagnosis changes nothing on the ticket: it records the person's answer on the suggestion row.

## Failure handling

Rows exist only for calls that were made. `attempts` on the row is the truth; the handler schedules its own retry with a start time. At most four provider calls per row.

| Case                                          | Outcome code        | What happens                                                                       |
| --------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| Feature off for the tenant                    | `feature_off`       | No call, no row, no retry                                                          |
| No consent, or consent withdrawn              | `no_consent`        | No call, no row, no retry                                                          |
| Monthly cap reached, or no cap set            | `cap_reached`       | No call, no row, no retry. The admin is told once a month through `notify`         |
| Ticket closed or cancelled before the job     | `stale`             | No call                                                                            |
| A term survives redaction                     | `redaction_failed`  | No call, no retry, alarm                                                           |
| Timeout (30 s), network error, 5xx            | `provider_error`    | 3 attempts: wait 30 s, then 2 min. Then the row is `failed`                        |
| 429 rate limit                                | `rate_limited`      | 4 attempts: wait `retry-after` (10 min at most), else 1, 2, 4 min                  |
| 529 overloaded                                | `overloaded`        | Same as 429                                                                        |
| 400, 401, 403                                 | `provider_rejected` | No retry, alarm                                                                    |
| Output fails the schema or is cut short       | `schema_invalid`    | 2 attempts. Then `failed`. Nothing is shown. The tokens are still counted          |
| The model refuses (amended 13 Nov, slice 55b) | `provider_rejected` | No retry (a refusal repeats); the tokens are still counted                         |
| Same key already claimed or done              | `duplicate`         | No call                                                                            |
| Process dies after the reply, before storing  | `provider_error`    | The retry calls again; `attempts` was raised before the call, so the ceiling holds |
| Success                                       | `ok`                | Row is `ready`. Shown only when the feature is live for the tenant                 |

A failed or missing suggestion never blocks a person. Two jobs racing the cap can overshoot by one call each; the provider console's own monthly limit is the backstop (verify in current docs).

## Logging and alarms

One log line per job: `tenantId`, `module`, `job`, `feature`, `promptVersion`, `modelRef`, `suggestionId`, `attempt`, `inputTokens`, `outputTokens`, `costMicroUsd`, `outcome`, `evidenceDropped`, `durationMs`. Never logged: the prompt, the output, search text, redaction terms, the placeholder map. The logger's redacted keys gain `prompt`, `input`, `output`, `query`.

| CloudWatch metric (from the log line) | Alarm                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `ai.outcome` count by `outcome`       | `redaction_failed` or `provider_rejected` ≥ 1; other errors > 10 an hour |
| `ai.cost` sum of `costMicroUsd`       | Month to date at 80% of any tenant's cap                                 |

The Platform lane defines both in `infra/`. They go to the alarm topic that staging already uses. The on-call operator owns the response.

## Tests the slices must carry

- Given a tenant person's name and phone in ticket text, when the prompt is built, then neither appears in it.
- Given a reply citing a ticket id of another tenant, when it is stored, then that id is gone and `evidenceDropped` is 1.
- Given two `ai.suggest` jobs with one key, when both run, then the provider is called once.
- Given no consent, a withdrawn consent, or a spent cap, when the job runs, then the fake provider records no call.
- Given a 429, a 529 and an invalid reply in turn, when the job runs, then the attempts and waits match the table.

## Rejected

- **A tool-use loop (the model calls `tickets.search` itself):** several round trips do not fit one 30-second job. Cost and output vary from run to run. Tenant scope would rest on tool arguments the model writes. The fake provider would have to script a conversation, so the test seam is lost. It also changes the published `AiProvider`.
- **The Agent SDK or the provider's SDK:** a new dependency, with its own retries on top of the job's.
- **A consent table or columns on `tenant`:** D17's budget; `setting` is already audited and already holds the spending caps.
- **A usage table:** the suggestion row is the call.
- **Turning placeholders back into names:** it keeps a name map alive and puts names into stored AI text.
- **Sending photos now:** faces, name boards and handwriting cannot be removed by a word list.

**Build phase (Nimish, 13 November):** these lines and the consent record do not block building or staging. Staging calls Claude now, using the staging key and the default cap of 50 USD a month. They gate production for a real plant only.
