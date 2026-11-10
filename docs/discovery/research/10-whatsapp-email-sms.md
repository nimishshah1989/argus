# Research: WhatsApp-first communication module (28 Oct 2026)

## Platform facts (Meta official docs unless noted)
- Groups API: max 8 participants, no interactive messages, requires Official Business Account (green tick) → unusable for cell groups; model cells in our DB and fan out 1:1. https://developers.facebook.com/documentation/business-messaging/whatsapp/groups
- Pricing (verified on Meta's page 28 Oct 2026): since 1 Oct 2026 utility messages inside an open 24h window are charged ("regular"); service messages free for first 1,000 per number per month, then charged; businesses need a payment method. INR billing mandatory for eligible Indian accounts by 31 Dec 2026; from 1 Jan 2027 non-INR accounts stop delivering. https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- India rates (secondary sources, confirm on rate-card CSV): utility/auth/service ~₹0.115 + 18% GST; marketing ~₹0.86.
- Reply buttons max 3 (20 chars); lists max 10 rows; templates up to 10 buttons (quick replies), max 2 URL buttons, 1 phone button.
- Messaging limits per business portfolio: 250 unique users/24h outside window at start, 2,000 after verification, then 10K/100K/unlimited with quality. Throughput 80 msg/s per number; pair limit ~1 message per 6 s to the same user (bursts allowed).
- Media: images 5 MB, audio 16 MB (OGG Opus mono); media URL expires in 5 min; webhook media IDs expire in 7 days → copy immediately.
- Flows: PhotoPicker 1-30 photos; no audio component; data_exchange endpoint needs encryption handling.
- Typing indicator + read receipt one call, up to 25 s.
- AI policy (from 15 Jan 2026): general-purpose assistants banned; business-specific bots allowed.
- Unofficial libs (Baileys, whatsapp-web.js): ban risk — never use.
- Meta's official Node SDK archived (June 2023) → call Graph API directly. n8n (Sustainable Use) and Typebot (FSL) licences unsuitable for a SaaS.

## Interaction design
1 Raise: QR → wa.me/<number>?text=BRK VC-18 → [Machine stopped] [Running, faulty] → photo + voice (Gujarati) → transcribe (Sarvam saaras, gu-IN) → confirm [Correct] [Change] [Cancel] → ticket no. + SLA.
2 Dispatch: template tkt_assigned to on-shift techs [Claim] [Can't take]; first claim wins.
3 Work: reply buttons by state: [Start] [Release] / [Pause] [Close] [Need help]; pause reason list.
4 Close: Flow job card (cause, action, spares, after-photo) or voice; PDF link.
5 Handback: template tkt_handback [Machine OK] [Dispute]; dispute reopens.
6 Escalation: template tkt_escalation [Acknowledge] [Reassign]; failed/unread → next tier; S1 also SMS.
7 Digest: template digest_daily 08:30 with PDF + link; weekly also email.
8 PM / Why-Why: templates pm_due, whywhy_due → Flows.
9 Fix Finder: text/voice question → list of top 5 past fixes.
Forwardable ticket summary for supervisors to paste into legacy cell groups during transition.

## Number strategy
One product-branded number in our own portfolio, WABA in INR; route sender phone → user → tenant. Per-tenant numbers later via Tech Provider + Embedded Signup v4 (v2/v3 deprecated 15 Oct 2026); onboarding cap 10 customers / 7 days until verified (then 200). Display name must match brand on a live verified website.

## Cost per plant (150 machines, 150 tickets, 20 users)
~1,050 utility templates + ~1,650 billed service messages ≈ ₹370/month incl. GST; transcription ≈ ₹75. Budget < ₹1,000/plant/month.

## Email / SMS
Amazon SES ap-south-1: $0.10 / 1,000 emails; DKIM, custom MAIL FROM, DMARC p=none→quarantine; request production access. Alternatives Postmark ($15/10K), Resend.
SMS: TRAI DLT Principal Entity registration ~₹5,900 one-time (PAN, authorisation letter, GST/CIN/Udyam), header + templates; MSG91/Gupshup ~₹0.12-0.25/SMS; Twilio ~₹7/segment (avoid).

## Accounts
Meta Business portfolio + verification (GST/CoI/PAN/Udyam + website + domain email) → developer app, WABA (INR), payment method, system-user token, webhook → fresh phone number → display name → templates (en, gu, hi) → later App Review + Tech Provider. Sarvam API. AWS SES. DLT + MSG91.
