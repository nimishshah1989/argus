# 0007 — Claude for AI features and for cleaning Cosmos's history

Date: 13 November 2026 (revised the same day after the architecture review)
Status: proposed (Nimish's decisions are in `docs/BRIEF.md`; the architecture and schema reviews are pending)

## Context

ARCHITECTURE §6 kept three AI residency options open: A, India-region inference; B, a self-hosted model in ap-south-1; C, inference outside India with consent and redaction. D16 blocked every real provider call until a record chose one.

Nimish, 13 November (BRIEF):

- AI may run outside India on Anthropic's Claude. Names and phone numbers are removed before sending. Each plant gives written consent first.
- Onboarding is not brought forward. A Claude session is used only to clean Cosmos's fuller history from Bhavin. A general import format waits for M5.
- The first part of M6 starts right after cutover. Diagnosis on the ticket is the first feature.

Anthropic's `claude-for-manufacturing` plugin (1.0.0, Apache-2.0, "reference implementation, not maintained") holds tested rules for breakdown diagnosis and data consolidation. The plan that uses it is `docs/plan/CLAUDE-ADOPTION.md`.

## Decision

1. **Option C. The vendor is Anthropic; the model is Claude.** `AiProvider`'s real implementation calls the Messages API, one request per suggestion. The model id is configuration. D16's grounding rules stand.
2. **The gate now has three locks** (D16 amended): this record accepted, the tenant's consent recorded, and a monthly cap set. CI always uses the fake provider.
3. **Call shape, redaction, consent, cap, failures and logs are in D22.** Text only; no photos or scanned pages.
4. **We adapt the plugin; we do not install it.** Its skill text becomes versioned prompt files and test cases that we own. It is unmaintained, assumes US dollars, New York time, English and three ERP systems, and is written for a conversation. Attribution is in `THIRD_PARTY.md`; each derived file names its source and says it was changed.
5. **History cleaning runs in a Claude session on pseudonymised copies.** The session produces one file. Code checks and loads it (D21). Nothing else from onboarding is built now.

## Data-protection note

| Question                                  | Answer                                                                                                                                                                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What is sent                              | Ticket problem text, close notes, breakdown report text (action, root cause, spare), machine code, make and model, categories and codes, dates and durations, internal ticket ids. For history cleaning: the pseudonymised copies of Bhavin's files                          |
| What is never sent                        | Names, short names, usernames and phone numbers of the plant's people (replaced first, D22). The plant's name. Photos, signatures, scanned pages, voice. Passwords, tokens, network addresses                                                                                |
| What may slip through                     | A nickname or a visitor's name typed inside free text. A word list cannot find these. The consent wording must say so                                                                                                                                                        |
| Where it is processed                     | Outside India, on Anthropic's infrastructure. The region is **to verify with the signed terms**                                                                                                                                                                              |
| Retention at Anthropic                    | **To verify with the signed terms.** We record the period here before the first real call                                                                                                                                                                                    |
| Use for training                          | **To verify with the signed terms.** We require that our content is not used to train models, and record the clause here                                                                                                                                                     |
| Sub-processors                            | **To verify with the signed terms**                                                                                                                                                                                                                                          |
| Roles under the DPDP Act 2023             | The plant decides what is collected (data fiduciary). We process it for the plant (data processor). Anthropic processes it for us. Our agreement with each plant must name Anthropic and the transfer. To confirm with legal (N14)                                           |
| Consent                                   | Written, per plant, before any call or session for that plant. Recorded as `ai.consent` with the signed document on file (D22). Withdrawal stops calls from the next job                                                                                                     |
| Deletion requests                         | Our copies: DATA-MAP §5 already covers AI suggestions. Stored AI text holds placeholders, not names. At Anthropic: sent text carried no listed name or number; whatever remains is removed under the retention terms above, or by the route those terms give (**to verify**) |
| Features that keep data with the provider | None is used: no stored files, no stored conversations, no batch upload. Using one needs this note amended first                                                                                                                                                             |
| Access                                    | One API key per environment in Secrets Manager, loaded only when the feature is on                                                                                                                                                                                           |

**No real call is made, on staging or production, until every "to verify" line above is filled in from the signed terms.**

## Rejected

- **Option A, India-region hosting:** not needed after the 13 November decision, and availability is unverified.
- **Option B, self-hosting a model:** GPU cost is far above the ₹30,000 rail.
- **Installing the plugin and running its skills on the server through the Agent SDK:** the skills ask questions mid-run, read export folders and print documents. Our features are bounded tasks in a 30-second job with a typed output.
- **A tool-use loop:** see D22.
- **A general import pack, `commitPack` for machines and people, and a `plant-onboarding` skill now:** deferred to M5 (Nimish).
- **An in-app AI onboarding wizard:** M5 at the earliest (ADR 0004).
- **Copying `pulse_compute.py`:** it is Python (ADR 0001 says TypeScript only) and computes production OEE, which SPEC defers.

## Consequences

- Ticket and history text of consenting plants is processed by Anthropic outside India. ADR 0002 lists it with the other outside services.
- Spend is recorded per call and capped per plant per month, with an alarm. The cost per call at our volume is unmeasured.
- Gujarati understanding by Claude is unverified. The evaluation harness measures it on pseudonymised Cosmos text before any feature goes live.
- No new table. The schema changes are listed in ARCHITECTURE §6 and ride in ticket 55's migration.
