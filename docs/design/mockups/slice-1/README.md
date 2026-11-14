# Slice 1 mockups: the reference images

Nimish approved these phone mockups on 14 Nov 2026 (the canvas: https://claude.ai/artifact/Tr4eCZnmM1wBMQjz3pXsaU,
boards A1 to A5 floor, B1 to B6 desk). The images here are the ground truth a built screen is compared against
(`docs/design/LOCK.md`; the PR template asks for a side-by-side at 360 px).

- One PNG per phone, 360 px wide, 1:1 (no phone frame). Light unless the name says `dark`; `gu` is the Gujarati
  layout test with placeholder text.
- Rendered from the published artboard HTML in the pinned Playwright image (D20) with the Noto fonts the gallery
  baselines use, reduced motion on. Palette-optimised: 53 files, about 787 KB in all.
- The canvas also has Start here, Q (the three questions, now answered in the lock) and N (design notes, folded
  into the lock). They are not images.
- Sample data only: "Person NN", plant-style machine codes. A mockup is not a spec for its sample numbers.

| File                                                    | Board | Screen                                                 |
| ------------------------------------------------------- | ----- | ------------------------------------------------------ |
| `A1-1-step-1-of-3-find-the-machine.png`                 | A1    | Step 1 of 3: find the machine                          |
| `A1-2-step-1-search-results.png`                        | A1    | Step 1: search results                                 |
| `A1-3-step-1-inside-a-group.png`                        | A1    | Step 1: inside a group                                 |
| `A1-4-step-2-of-3-the-situation.png`                    | A1    | Step 2 of 3: the situation                             |
| `A1-5-step-3-of-3-the-problem-then-send.png`            | A1    | Step 3 of 3: the problem, then Send                    |
| `A2-1-sent.png`                                         | A2    | Sent                                                   |
| `A2-2-my-complaints.png`                                | A2    | My complaints                                          |
| `A2-3-other-work-not-a-machine.png`                     | A2    | Other work (not a machine)                             |
| `A2-4-step-3-for-maintenance-i-am-starting-work-on.png` | A2    | Step 3 for maintenance: "I am starting work on it now" |
| `A3-1-loading.png`                                      | A3    | Loading                                                |
| `A3-2-empty-my-complaints.png`                          | A3    | Empty: My complaints                                   |
| `A3-3-offline.png`                                      | A3    | Offline                                                |
| `A3-4-error-on-send.png`                                | A3    | Error on send                                          |
| `A3-5-already-reported-opens-the-existing-ticket.png`   | A3    | Already reported: opens the existing ticket            |
| `A3-6-machine-with-an-open-support-ticket.png`          | A3    | Machine with an open support ticket                    |
| `A4-1-dark-step-1-find-the-machine.png`                 | A4    | Step 1                                                 |
| `A4-2-dark-step-3-problem.png`                          | A4    | Step 3                                                 |
| `A4-3-dark-sent.png`                                    | A4    | Sent                                                   |
| `A4-4-dark-my-complaints.png`                           | A4    | My complaints                                          |
| `A5-1-gu-step-1-find-the-machine.png`                   | A5    | Gujarati placeholder: step 1 find the machine          |
| `A5-2-gu-step-2-situation.png`                          | A5    | Gujarati placeholder: step 2 situation                 |
| `A5-3-gu-step-3-problem.png`                            | A5    | Gujarati placeholder: step 3 problem                   |
| `A5-4-gu-sent.png`                                      | A5    | Gujarati placeholder: sent                             |
| `B1-1-open-counts-breakdowns.png`                       | B1    | Open                                                   |
| `B1-2-open-further-down-needs-report.png`               | B1    | Open, further down: needs report                       |
| `B1-3-mine.png`                                         | B1    | Mine                                                   |
| `B1-4-team.png`                                         | B1    | Team                                                   |
| `B2-1-detail-top.png`                                   | B2    | Detail, top                                            |
| `B2-2-detail-middle-minutes-people-history.png`         | B2    | Detail, middle: minutes, people, history               |
| `B2-3-detail-bottom-the-action-bar.png`                 | B2    | Detail, bottom: the action bar                         |
| `B2-4-a-closed-ticket.png`                              | B2    | A closed ticket                                        |
| `B3-1-not-started-operator.png`                         | B3    | Operator                                               |
| `B3-2-not-started-technician.png`                       | B3    | Technician                                             |
| `B3-3-not-started-supervisor.png`                       | B3    | Supervisor                                             |
| `B3-4-not-started-admin.png`                            | B3    | Admin                                                  |
| `B3-5-working-operator.png`                             | B3    | Operator                                               |
| `B3-6-working-technician-not-lead.png`                  | B3    | Technician (not lead, not primary)                     |
| `B3-7-working-supervisor.png`                           | B3    | Supervisor                                             |
| `B3-8-working-admin.png`                                | B3    | Admin                                                  |
| `B3-9-cancelled-operator.png`                           | B3    | Operator                                               |
| `B3-10-cancelled-technician.png`                        | B3    | Technician                                             |
| `B3-11-cancelled-supervisor.png`                        | B3    | Supervisor                                             |
| `B3-12-cancelled-admin.png`                             | B3    | Admin                                                  |
| `B4-1-operator-opens-the-desk-address.png`              | B4    | Operator opens the Desk address                        |
| `B4-2-technician-opens-settings-people.png`             | B4    | Technician opens Settings, People                      |
| `B4-3-supervisor-opens-settings-machines.png`           | B4    | Supervisor opens Settings, Machines                    |
| `B5-1-sync-online.png`                                  | B5    | Online                                                 |
| `B5-2-sync-offline.png`                                 | B5    | Offline                                                |
| `B5-3-sync-sending.png`                                 | B5    | Sending                                                |
| `B5-4-sync-draft.png`                                   | B5    | Draft                                                  |
| `B6-1-dark-open.png`                                    | B6    | Open                                                   |
| `B6-2-dark-detail-minutes-people-history.png`           | B6    | Detail: minutes, people, history                       |
| `B6-3-dark-action-bar-supervisor-working.png`           | B6    | Action bar (supervisor, working ticket)                |
