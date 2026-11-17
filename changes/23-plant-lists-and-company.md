- Plant settings now cover the plant's own lists and company. Wait reasons, work types, quick problems and the
  glossary are edited on the same generated settings screens as machines: add an entry, edit it in the sheet on a
  phone (the right-hand panel on a desktop), switch it off, or set a wait reason's pauses-SLA and vendor flags and a
  work type's lockout flag. The old hand-built wait-reason switches on the desk settings page are gone, so there is
  one place to change them. Head and admin only, as the lock says, and every change goes to the audit trail.
- Company settings are a screen too: name, language, time zone, the three feature switches (work requests, pause and
  the operators' Live board) and the logo, which uploads to its own route and shows on the sign-in screen. The
  existing `settings-plant.spec.ts` stays green; `settings-lists.spec.ts` and `settings-company.spec.ts` prove the
  generated screens and the config that builds them.
