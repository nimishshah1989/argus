# Research: capture channels and infrastructure (as of 27 Oct 2026)

## Recommended stack
| Layer | Pick | Why |
|---|---|---|
| Capture | WhatsApp Cloud API direct, one shared number first; route by sender phone to tenant | Service replies free in 24h window; utility templates cheap; no BSP markup |
| Structured capture | Plain messages (voice note + photo) + PWA deep link; WhatsApp Flows for text/dropdown triage only | Flows media upload needs AES-256 decrypt + HMAC verification |
| Speech-to-text | Sarvam Saaras v4 (gu-IN supported) | ~₹0.49/min; transcribe / translate-to-English / codemix modes; real-time REST max 30 s audio, batch up to 2 h |
| App | Next.js PWA (offline + Web Push) | QR on machine = URL into the PWA; camera via capture attribute |
| Backend | Supabase (Postgres + RLS + Auth + Storage + Queues/pgmq + Edge Functions) in ap-south-1 Mumbai | One managed vendor, data in India |
| Web hosting | Vercel functions pinned to bom1 (Mumbai) | Default region is US iad1 — must pin |
| Tenancy | Shared schema + tenant_id + RLS; JWT custom claims for role + tenant | Lowest ops; DB-per-tenant as enterprise upsell |

## WhatsApp facts
- Per-message pricing since 1 Jul 2025; Marketing / Utility / Authentication templates; service messages free in 24h window; utility templates inside the window free. Prices change only on 1 Jan/Apr/Jul/Oct. https://developers.facebook.com/docs/whatsapp/pricing
- India rates (secondary source, verify in Business Manager): marketing ~₹0.86, utility/auth ~₹0.115, + 18% GST. Claimed INR billing migration deadline 31 Dec 2026 — UNVERIFIED with Meta.
- Media URLs expire in 5 min; incoming media IDs in 7 days → download immediately. Audio up to 16 MB; images 5 MB.
- Per-tenant numbers need Meta Tech Provider enrolment + Embedded Signup (360dialog partner route).
- From 15 Jan 2026 Meta bars general-purpose AI assistants via the Business API; business-specific support bots allowed. Keep the bot task-bound. https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform
- Cloud API Local Storage lists India for data at rest.
- BSPs: Twilio +$0.005/msg; 360dialog €49/number/month; Interakt/AiSensy are marketing inboxes (wrong fit).

## STT options
| Option | Gujarati | Price | Note |
|---|---|---|---|
| Sarvam Saaras v4 | Yes | ₹0.49/min | India-hosted (vendor claim; get it in DPA) |
| Google Chirp 3 | Preview only | $0.016/min | us/eu regions only |
| OpenAI gpt-4o-transcribe | not verified | ~$0.006/min | US processing |
| ElevenLabs Scribe v2 | has Gujarati page | $0.22/hr batch | untested |
| AI4Bharat IndicConformer | Yes | free, self-host GPU | MIT repo |
No published Gujarati WER benchmark for factory noise → run a bake-off on 50-100 real voice notes.

## Hosting / cost (ESTIMATE, 5-10 factories)
Supabase Pro + Small ~$30; Vercel Pro ~$20; Sarvam ~₹735; WhatsApp templates ~₹575 + GST → ≈ ₹6,000-9,000/month. PITR backups +$100/month. Supabase has Mumbai, no Hyderabad; AWS has ap-south-2 Hyderabad.

## DPDP Act 2023 + Rules 2025
- Rules notified 13 Nov 2025. Consent Manager provisions at 12 months (13 Nov 2026). Main obligations (notice, security safeguards Rule 6, breach notice Rule 7 incl. 72-hour report, retention/erasure Rule 8, rights, penalties) at 18 months = 13 May 2027.
- MeitY proposed shortening to 12 months; as of 9 Oct 2026 not gazetted — re-check.
- Factory = Data Fiduciary; our SaaS = Data Processor under contract (s.8). Employment data processable under legitimate use s.7(i).
- Build: DPA template, encryption, access control, logs retained ≥1 year (Rule 6), breach alerting, per-tenant export + erasure.

## On-prem
No credible evidence Indian MSMEs insist on on-prem. Don't build now; Supabase self-host keeps the door open.
