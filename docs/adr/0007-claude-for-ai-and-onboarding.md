# 0007 — Claude for AI features and plant onboarding

Date: 13 November 2026
Status: proposed (Nimish decided the residency question on 13 November; architecture review pending)

## Context

ARCHITECTURE §6 kept three AI residency options open: A, India-region inference; B, a self-hosted model in ap-south-1; C, inference outside India with consent and redaction. D16 blocks every real provider call until a record chooses one.

Nimish, 13 November: data leaving India for AI is not a constraint. Separately, Anthropic's `claude-for-manufacturing` plugin (Apache-2.0, "reference implementation, not maintained") holds tested rules for breakdown diagnosis, data consolidation and plant onboarding that fit our M4 to M6 work. The plan that uses it is `docs/plan/CLAUDE-ADOPTION.md`.

## Decision

1. **Option C.** `AiProvider`'s real implementation calls Anthropic's Claude through the Messages API with tool use. The model id is configuration. The D16 gate opens for this provider once this record is accepted. Everything else in D16 stands: grounding, shadow first, confirm through the owning command, and no number or code from model text.
2. **Redaction before send stays.** Names, phone numbers and usernames are replaced with stable placeholders in the adapter. The tenant's consent to processing outside India is recorded (N14) before a real call is made for that tenant.
3. **We adapt the plugin; we do not install it in the product.** Its skill text becomes versioned prompt files and repo skills that we own. The reasons:
   - It is unmaintained.
   - It assumes US dollars, New York time, English, and NetSuite, Fusion and Limble.
   - It is written for a conversation, not for a phone screen.

   Attribution goes in `THIRD_PARTY.md`.

4. **Onboarding runs in a Claude session, not in the app, for now.** A repo skill converts whatever a plant sends into a versioned import pack. The server validates and commits it with undo. Code is the gate; Claude does the mapping.

## Rejected

- **Option A, India-region hosting:** not needed after the 13 November decision, and availability is unverified.
- **Option B, self-hosting a model:** GPU cost is far above the ₹30,000 rail.
- **Installing the plugin and running its skills unchanged on the server through the Agent SDK:** the skills ask questions mid-run, read export folders and a plant-setup file, and print documents. Our features are bounded tasks in a 30-second job with a typed output. A long agent loop adds cost and nondeterminism and has no test seam.
- **An in-app AI onboarding wizard now:** about ten times the work of a session skill, for a step that runs a few times per customer. Revisit when self-serve onboarding is a product goal (ADR 0004).
- **Copying `pulse_compute.py`:** it is Python (ADR 0001 says TypeScript only) and computes production OEE, which SPEC defers.

## Consequences

- Ticket text, photos and manual pages for consenting tenants are processed by Anthropic outside India. This is documented with the other outside services in ADR 0002.
- Spend is logged per call from `usage` and capped per tenant per month, with an alarm. The cost per call at our volume needs measuring and is unverified here.
- Gujarati understanding by Claude is unverified. The evaluation harness measures it on pseudonymised Cosmos text before any feature goes live.
- ARCHITECTURE §6 (the AI layer and residency line) and BRIEF open question 3 are updated by the architect step that accepts this record.
