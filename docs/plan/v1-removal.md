# Removing every v1 page (ADR 0051)

Inventory taken on `origin/main` 6e4c7b99, 26 Nov 2026. "v1" = a page or page body rendered from outside `apps/web/src/screens/v2/`. v1-located **logic** (`.ts` files v2 imports, such as `screens/analytics/figure-content.ts`, `groups.ts`, `guide-entries.ts`, `desk/openLists.ts`, `faces/signin/act-as.ts`) is not a page and stays; the guard in #819 allows it.

| v1 thing a user can reach                                                           | Where                                                  | Removed by                |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------- |
| `/who` Who is using this phone                                                      | `App.tsx` → `faces/signin/who.tsx`                     | #816                      |
| `/password` Change password                                                         | `App.tsx` → `faces/signin/password.tsx`                | #817                      |
| `/floor/mine`, `/floor/pm` and their sheets                                         | `faces/floor/*`                                        | #768                      |
| `/desk/mine`, `/desk/team`                                                          | `screens/Desk.tsx`, `desk/Shell.tsx`, panels           | #770                      |
| `/desk/settings`                                                                    | `screens/Settings.tsx`                                 | #795                      |
| Ticket page and the desk pane (v1 `TicketDetail`)                                   | `desk/TicketRoute.tsx`, `v2/desk/Page.tsx`             | #771                      |
| Settings bodies: machines, groups, shifts                                           | `settings/Plant.tsx` specs                             | #789                      |
| Settings bodies: PM plans, registers, roster, ladder                                | same                                                   | #790                      |
| Settings bodies: people, logins                                                     | `settings/People.tsx`                                  | #791                      |
| Settings body: audit                                                                | `settings/Audit.tsx`                                   | #792                      |
| Settings bodies: lists, glossary, analytics profile                                 | `settings/Lists.tsx`                                   | #793                      |
| Settings bodies: company, translations                                              | `settings/Company.tsx`, `Translations.tsx`             | #794                      |
| Monthly report                                                                      | v1 GroupPage for `reports`                             | #763                      |
| Unknown `?screen=` on `/analytics/reports`, `/analytics/guide` → v1 `GroupPage`     | `analytics/Analytics.tsx`, `v2/live.tsx` `WHOLE`       | #818                      |
| v1 analytics page chain (GroupPage, FigureTile, DrillTable, AnalyticsShell …)       | `screens/analytics/*`                                  | #818                      |
| Dead v1 files (key-screen, KeyPage, key-body, screen-menu, engine-table …)          | `screens/analytics/*`                                  | #818                      |
| The settings shell's v1 `Body` fallback; leftover v1 files; the guard keeping it so | `v2/settings/View.tsx`, `settings/Plant.tsx`, `desk/*` | #819 (last)               |
| OEM (never had a v1 page; gallery only)                                             | `screens/v2/oem`                                       | #812 → #813 → #814 → #815 |
