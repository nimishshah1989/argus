# Borrowable capabilities — second research pass

For the owner. Plain English. This is a follow-up to `docs/research/upkeep-vs-uptimo.md` (which
established what UpKeep sells and where Uptimo stands). This pass looked at four *other* sources,
asking one question: is there a capability here we could BORROW (re-implement the idea), EMBED
(copy the actual code/files in), or INTEGRATE (call it as a service)? Every claim below comes from
a page we actually fetched on the date at the bottom. Where a source is empty, stale or an
announcement without proof, we say so plainly.

The three buckets, in one line each:

- **BORROW** — we re-implement the *idea* in our own code. No licence issue, because no code is copied.
- **EMBED** — we vendor the actual files into our repo. Only possible when the licence permits, and
  it makes us the maintainers of someone else's work.
- **INTEGRATE** — we call it as a service/API/CLI. No code copied, but our product then depends on
  someone else's uptime, pricing and rules.

---

## 1. What each of the four sources actually is

### 1.1 `llbbl/upkeep` — an unrelated project that happens to share our research name

- **URL:** https://github.com/llbbl/upkeep · **Licence: MIT** (LICENSE says "MIT License,
  Copyright (c) 2026 Logan Lindquist Land").
- **What it is:** Not a CMMS, not a fork of upkeep.com, and nothing to do with maintenance of
  machines. Its own README: "A maintenance toolkit for JavaScript and TypeScript repositories,
  built with Bun" — a command-line tool that checks a *codebase* ("what is outdated, what is
  vulnerable, what is dead weight, how healthy is the whole thing"), plus four Claude Code skills
  (`deps`, `audit`, `quality`, `trim`) that shell out to it. Every command "emits JSON".
- **Stack/maturity:** TypeScript/Bun. 3 stars, 0 forks. Created 20 Jan 2026, last push 16 Nov 2026
  (yesterday) — small but actively developed. Structured docs (INSTALLATION, CLI, SKILLS,
  DEVELOPMENT, RELEASING). Single author.
- **Verdict:** A name collision. Useful only to *us as developers*, not to the product. Its one
  genuinely good idea — a CLI that emits JSON, with agent skills as thin wrappers over it — is a
  pattern worth stealing for our M6 AI architecture (see section 3, item 5).

### 1.2 `upkeepapp` — the real UpKeep company's GitHub org, and it is empty of anything useful

- **URL:** https://github.com/upkeepapp · **Licences:** each repo carries whatever its upstream
  had (mostly MIT on the forks); two interview repos have **no licence file at all**.
- **What it is:** Confirmed as UpKeep Technologies, Inc. — the CMMS company from our first pass
  ("Simplifying maintenance workflows and asset management for all"). We pulled the full public
  repo list via the GitHub API (17 repos). It contains: forks of old iOS/JS UI libraries
  (MessageViewController, ProgressHUD, MWPhotoBrowser, RESideMenu, react-select, CLImageEditor,
  angular-google-maps, apicache, ActiveLabel.swift, JBChartView, CocoaPods, slate, mosql), an
  **archived, empty** LangGraph template fork, and three recruitment/interview repos
  (candidate-ui, integration-mock-service, mobile-interview-take-home-assignment-server-2).
- **Stack/maturity:** Nothing of theirs is product code. The most recent non-fork activity is a
  2024 interview repo; the newest item overall is a 2025 fork of an empty template. Most repos
  have 0 stars.
- **Verdict:** **There is nothing to embed, integrate or borrow here.** UpKeep keeps its product
  closed — its capabilities can only be imitated, which was the business of the first pass. Two
  interview repos have no licence: those must not be copied even for curiosity (section 4).

### 1.3 `ScottDuncanAI/claude-manufacturing-skills` — a real, MIT-licensed Claude skill, but one skill, not a pack, and chemical-engineering, not factories

- **URL:** https://github.com/ScottDuncanAI/claude-manufacturing-skills · **Licence: MIT**
  (LICENSE says "MIT License, Copyright (c) 2026 Scott Duncan"; the README adds: "The license
  covers the skill text and code. It does not make generated drawings correct or replace
  engineering judgment.").
- **What it is:** Despite the plural name, the repo currently contains **one** Claude skill,
  `pfd-generator`: you describe a process in plain English and it produces an editable SVG
  process flow diagram (equipment, streams, control loops), plus the Python script that drew it.
  Its structure is the instructive part: a `SKILL.md` of drawing instructions, `references/` of
  domain conventions, `scripts/` of reusable SVG components, and a workflow where Claude renders
  the drawing, **inspects it for defects** (overlapping labels, crossed lines, incomplete loops),
  fixes and repeats — and "if rendering is unavailable, Claude must say that the drawing has not
  been visually checked." The README is equally honest about limits: "It is not an
  issued-for-design P&ID, does not size equipment or relief devices… A qualified engineer must
  review."
- **Stack/maturity:** Python + Markdown skill files. 86 stars, 25 forks, 0 open issues. Created
  5 Aug 2026, last push 11 Nov 2026 — new, small, actively maintained, real examples included.
  Single author (Scott Duncan, chemical process engineer).
- **Verdict on the owner's three options:** (a) a genuine capability to embed for M6? **No** —
  the domain content is chemical-plant drawing conventions (its example is a depropanizer), not
  factory maintenance. (b) Useful to *us as developers*? **Yes, genuinely** — the skill-file
  structure and the render→inspect→fix→disclose-limits loop are exactly the discipline our M6
  agent work should follow, and MIT lets us copy the skeleton with attribution. (c) Marketing?
  No — it is a working artefact with examples, not a pitch.

### 1.4 The machinetoolnews.ai article — a news report of Anthropic's product launch, not a deployment story

- **URL:** https://machinetoolnews.ai/claude-for-manufacturing-ai/ · **Licence: none** (a
  copyrighted news article — read it, don't copy it).
- **What it is:** "Claude for Manufacturing: 17 Powerful AI Skills for Factories" (Jelena
  Radojcic, 16 Nov 2026) reports **Anthropic's launch of "Claude for Manufacturing"** (announced
  12 Nov 2026): a plugin for **Claude Team/Enterprise** with 17 skills and 4 connectors
  (Autodesk Fusion, Infor, Microsoft 365, Oracle NetSuite). Named applications: job quoting,
  quality management (corrective-action reports), **maintenance diagnosis** ("examining equipment
  records, sensor exports and technical documentation to suggest possible causes of breakdowns"),
  supply chain, engineering, production reporting. The article is explicit that Claude writes
  recommendations only — "does not directly operate production equipment" — and that the Infor
  write path requires "approval from an authorised employee".
- **What did a manufacturer actually deploy?** **Nothing we can point to.** This is a vendor
  launch reported by a trade journalist; no manufacturer customer is named, and the article says
  so itself: "Anthropic has not published independently verified manufacturing productivity
  results, deployment costs or return-on-investment figures." Its own suggested measures
  (quoting time, report completion time) are "suggested evaluation measures, not independently
  demonstrated results."
- **Copyable or anecdote?** The plugin itself: **not copyable** — closed commercial software for
  Western ERP stacks, priced in Claude enterprise seats, in English. The *capability list*: fully
  copyable as ideas, and it is the most useful thing in this pass — a well-funded vendor just
  published a prioritised list of what manufacturers ask AI to do, and three of the six map
  directly onto our roadmap (see section 3).
- **Is it an advert?** Not quite — the journalist repeatedly and unpromptedly flags the absence
  of evidence, which is more honest than most launch coverage. But it is still a launch report:
  marketing material with a critical wrapper, not proof of anything.

---

## 2. The bucket table

| Capability | Source | Borrow/Embed/Integrate | Why | Size | Risk |
|---|---|---|---|---|---|
| Maintenance diagnosis drafts (likely cause + similar past tickets, technician verifies) | machinetoolnews / Anthropic launch [1.4] | **Borrow** | The idea is copyable, the plugin is not; our own ticket history is the data it needs | 2–3 weeks in M6 | Wrong drafts erode trust — must cite the evidence it used |
| Corrective-action / breakdown narrative drafting, in Gujarati, into the PDF we already print | machinetoolnews / Anthropic launch [1.4] | **Borrow** | Same reasoning; our breakdown PDF and audit trail already hold the raw fields | 1–2 weeks in M6 | Hallucinated detail — restrict it to summarising recorded fields only |
| Agent-skill file structure + render→inspect→fix loop + "not verified" disclosure | ScottDuncanAI skill [1.3] | **Borrow** (embedding the skeleton is MIT-legal but we would rewrite all domain content) | The discipline is domain-free; the PFD content is chemical-plant-specific | Days to adopt as a standard; ongoing practice | Near zero |
| Figure screens: downtime, output, missed targets per shift/month | machinetoolnews / Anthropic launch [1.4] | **Borrow** | Independent confirmation that production reporting is a top-6 manufacturer ask; already our M4a plan | Already planned (M4a, 1–2 weeks) | Low |
| "CLI/API emits JSON; skills or UIs are thin wrappers" architecture rule for M6 | llbbl/upkeep [1.1] | **Borrow** | If our AI features call the same JSON endpoints as the PWA, M6 stays testable and multi-surface | ~0 extra days if adopted as a rule from M4a | Low |
| `pfd-generator` skill files themselves (SKILL.md + scripts) | ScottDuncanAI [1.3] | **Do not embed** (MIT would permit it) | Wrong domain; Python SVG tooling we would rewrite for Gujarati machine trees | — | Maintenance drag, domain mismatch |
| Anthropic's Claude for Manufacturing plugin | machinetoolnews / Anthropic launch [1.4] | **Do not integrate** | Closed commercial plugin, Claude Team/Enterprise seats, Infor/NetSuite/M365/Fusion connectors, English; nothing for a Gujarati floor on a per-plant price | — | Cost, fit, dependence |
| Anything from `upkeepapp` org repos | upkeepapp [1.2] | **Nothing** | Old forks, interview repos, an archived empty template; no product code; two repos have no licence | — | Licence risk on the unlicensed repos |
| Repo health checks (deps/audit/quality grade) for our own monorepo | llbbl/upkeep [1.1] | **Borrow lightly** (or just keep using `pnpm outdated`/`pnpm audit`) | Developer-only convenience; our stack is pnpm, so the pattern suffices | 1–2 days, any time | None — purely internal |

No source in this pass carries a copyleft (GPL/AGPL) licence. Both repos are MIT. The two
licence dangers are different: the unlicensed `upkeepapp` interview repos (default copyright —
all rights reserved) and the copyrighted news article (text and images).

---

## 3. Ranked shortlist — five capabilities, best effort-to-value for an Indian factory buyer

1. **AI maintenance diagnosis drafts.** *What changes for a user:* when a breakdown is reported,
   the supervisor sees a Gujarati first draft — "machines like this usually fail this way; your
   plant had 3 similar breakdowns: here they are" — instead of a blank page. *Bucket:* Borrow
   (from the Anthropic launch's maintenance application). *Size:* 2–3 weeks, in M6. *Risk:* an
   unverified wrong suggestion is worse than none, so it must always show the tickets it based
   the draft on and say "verify on the machine". *Build first:* M4a/M4b — without searchable
   ticket history and machine records there is nothing to reason over.
2. **Auto-drafted repair / corrective-action narratives.** *What changes:* closing a heavy
   breakdown produces the printed Gujarati report with "what happened / what was done / what to
   prevent" pre-written from the ticket's own fields, for the supervisor to edit — the document
   Indian plants pin on the board, in minutes not evenings. *Bucket:* Borrow (from the launch's
   quality-management application). *Size:* 1–2 weeks, M6. *Risk:* low if the AI may only
   restate recorded facts. *Build first:* the breakdown PDF (already built) and M6.
3. **The render→inspect→fix loop and honest-limit disclosures for every M6 AI feature.** *What
   changes for a user:* our AI says "this draft was not checked against records" when it cannot
   verify, the way Duncan's skill refuses to claim a drawing was visually checked — trust on a
   factory floor is lost once and not regained. *Bucket:* Borrow pattern; the MIT skeleton could
   be embedded with attribution, but only its shape survives translation to our domain.
   *Size:* days to write as our standard; free thereafter. *Risk:* none. *Build first:* the M6
   agent harness.
4. **Figure screens (downtime, output, missed targets).** *What changes:* the owner opens the
   board on Monday and sees last week's downtime and misses without asking anyone. *Bucket:*
   Borrow — already our M4a plan; the Anthropic launch independently confirms production
   reporting as a core manufacturer ask. *Size:* already planned, 1–2 weeks. *Risk:* low.
   *Build first:* the analytics engine shell (exists).
5. **JSON-first internal APIs as a house rule.** *What changes for a user:* nothing visible
   today; it is what makes items 1–3 shippable in weeks instead of months, because the AI and
   the PWA read the same endpoints our tests already exercise — the one transferable idea in
   llbbl/upkeep. *Bucket:* Borrow (a rule, not code). *Size:* ~zero extra days if adopted from
   M4a onward. *Risk:* none. *Build first:* nothing; apply it to the next M4a API.

---

## 4. What we should NOT touch, and why

- **Nothing from the `upkeepapp` GitHub org.** Old library forks and interview repos; the two
  unlicensed repos are all-rights-reserved by default. And the absence of any product code,
  SDK or API library from the company confirms: their features can only be re-imagined by us,
  never taken.
- **Anthropic's Claude for Manufacturing, as a dependency.** Closed, seat-priced, English,
  connector-first for Infor/NetSuite/M365/Fusion — the opposite of a per-plant-₹, Gujarati,
  shared-phone product. And it has zero published proof of results; adopting it would couple our
  M6 story to an unproven enterprise bet.
- **The chemical-PFD content of `pfd-generator`.** MIT permits copying, but depropanizer
  conventions and Python SVG parts are the wrong domain and the wrong stack; we would maintain
  code we immediately discard. Take the loop, not the files.
- **Text or images from the machinetoolnews article.** No licence; quoting facts is fine,
  reproducing prose is not.
- **Hardware — unchanged from pass 1.** The article's "sensor exports" language is about files
  customers already have, not a reason to enter hardware.
- **Suite sprawl and ERP-first integrations** — the first pass said it; this pass found nothing
  that changes it.

## 5. Suggested order of adoption against our plan

- **M2 (accountability, now):** nothing from this pass. At most, start the JSON-first API rule in
  code review habits.
- **M4a (analytics, next):** the figure screens (item 4), and make the new analytics endpoints
  JSON-first (item 5) while they are being written — this is where the rule is free.
- **M4b (PM/parts):** unchanged from the first pass. PM and parts remain the biggest product gap;
  none of today's four sources helps there.
- **M6 (AI):** items 1–3, in that order — diagnosis drafts, narrative drafting, and the
  inspect-and-disclose discipline governing both. Note for M6 planning: our AI should be built as
  skills/instructions over our own JSON APIs, in the shape the Duncan repo demonstrates, not as a
  bolt-on chat window.

## 6. Sources

Every page below was fetched on the date at the bottom. One line each on what it established.

- `https://github.com/llbbl/upkeep` — repo page: title/description confirming it is "Claude Code
  skills backed by a Bun CLI… for maintaining JavaScript and TypeScript repositories".
- `https://api.github.com/repos/llbbl/upkeep` — metadata: TypeScript, 3 stars, created 20 Jan 2026,
  pushed 16 Nov 2026, licence MIT, default branch `main`.
- `https://raw.githubusercontent.com/llbbl/upkeep/main/README.md` — what the CLI does (detect, deps,
  audit, quality, imports), JSON output, the four skills, "License: MIT".
- `https://raw.githubusercontent.com/llbbl/upkeep/main/LICENSE` — "MIT License, Copyright (c) 2026
  Logan Lindquist Land", permission to "use, copy, modify, merge, publish, distribute, sublicense,
  and/or sell".
- `https://github.com/upkeepapp` — org page: "UpKeep — Simplifying maintenance workflows and asset
  management for all" — confirming it is the CMMS company.
- `https://api.github.com/orgs/upkeepapp/repos?per_page=100&sort=pushed` — the full public repo
  list (17 repos): forks of iOS/JS libraries, an archived empty langgraph template, interview
  repos, no product code; licences mostly MIT (inherited by forks), at least one `license: null`.
- `https://github.com/ScottDuncanAI/claude-manufacturing-skills` — repo page: "Claude Skills that
  encode chemical process and manufacturing engineering practice".
- `https://api.github.com/repos/ScottDuncanAI/claude-manufacturing-skills` — metadata: Python,
  86 stars, 25 forks, 0 open issues, created 5 Aug 2026, pushed 11 Nov 2026, licence MIT.
- `https://raw.githubusercontent.com/ScottDuncanAI/claude-manufacturing-skills/main/README.md` —
  the single `pfd-generator` skill, its install paths, its render→inspect→fix workflow, its limits
  section, and the licence note that MIT "does not make generated drawings correct".
- `https://raw.githubusercontent.com/ScottDuncanAI/claude-manufacturing-skills/main/LICENSE` —
  "MIT License, Copyright (c) 2026 Scott Duncan".
- `https://machinetoolnews.ai/claude-for-manufacturing-ai/` — the full article text: Anthropic's
  Claude for Manufacturing launch (12 Nov 2026), 17 skills, 4 connectors, the six named
  applications, the human-approval pattern, "does not directly operate production equipment", and
  the explicit statement that no productivity or ROI results have been independently verified.

**Date of research:** 17 November 2026.

Fetch note: 12 fetches across the four sources. GitHub HTML pages truncate heavily in our fetcher,
so repository facts come from the GitHub API and raw file endpoints for the same repos — same
content, stable URLs.
