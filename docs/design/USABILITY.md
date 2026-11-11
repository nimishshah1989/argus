# Usability plan — later D0.3 sessions

**Status: script only. No sessions have been recruited, facilitated or analyzed.** This plan does not establish usability, visual approval, real-device coverage or production readiness.

## Participants and evidence

- Recruit **3–5 operators** (include setters where possible) and **3 technicians** who do the actual work.
- Use each person's real work phone where possible. Record device class, OS/browser, installed-PWA/browser mode, input language and connectivity; never record passwords, personal ticket text or real names in the notes.
- If a real phone is unavailable, use a controlled fallback and label it **synthetic / not real-device evidence**.
- Run against the isolated clickable prototype with synthetic people, machines and tickets. Do not mutate production or the legacy system.
- Gujarati tasks use copy supplied or reviewed by Cosmos's team. Do not substitute machine translation and call it a Gujarati session.

## Measures

For every attempt, record:

| Field      | What to capture                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Completion | completed independently / completed with help / abandoned                                                    |
| Time       | seconds from the task-start signal to the defined success state                                              |
| Errors     | wrong choice, backtrack, duplicate attempt, validation error or unresolved offline error; count and describe |
| Assistance | exact hint needed; do not count an unprompted facilitator explanation as success                             |
| Confidence | participant rating, 1 = not confident, 5 = very confident, before the facilitator reveals the answer         |
| Friction   | observed hesitation plus the participant's own words; separate observation from facilitator interpretation   |

Also capture phone/browser constraints, whether condition and work were read correctly, whether the participant found underlying detail, and any accessibility or language barrier. Keep raw notes separate from the later summary; do not turn small samples into population percentages.

## Common session script (10 minutes per participant plus tasks)

1. **Consent and scope:** "I am testing an early design, not you. It uses fake data and does not change the plant system. May I observe and take anonymous notes?"
2. **Neutral instruction:** "Please work as you normally would and say what you expect. I cannot help until you ask. You may stop at any time."
3. **Baseline:** ask what phone/browser they normally use, whether they share a phone, and which language they prefer for maintenance work.
4. Give one task at a time using the prompts below. Start the timer after reading the prompt; do not demonstrate the path first.
5. After each task, ask: "How confident are you that the job is complete, from 1 to 5? What made you choose that?" Record the answer without defending the design.
6. Close with: "Where did you hesitate? What did you expect to see underneath? Was anything unclear about the machine condition versus the work state?"

## Operator sessions — 3–5 people

### Task O1 — Report a stopped machine

Prompt: "VC-5 has stopped with a spindle alarm. Report it and tell me when the report is safely with maintenance."

Success: the correct machine and stopped condition are chosen, the problem is entered, and the participant distinguishes server confirmation from a queued/pending result. Record duplicate-open handling if the scenario supplies an existing open ticket.

### Task O2 — Report a support need and find the report

Prompt: "The machine is running but needs support. Report that, then find your own report and open its current condition and work state."

Success: the participant selects support rather than stopped, finds only the acting person's My complaints, and opens detail without needing a Desk route intended for maintenance.

### Task O3 — Offline and other-work check (prototype capability only)

Prompt: "Your signal has dropped. Try the stopped/support report, then try an other-work request. Tell me what is safe to do."

Success for the designed behavior: stopped/support can be queued with visible pending and a stable replay identity; unresolved failure stays needs-attention; general/other-work clearly requires a connection. This is a later prototype test, not a claim that the production queue exists.

## Technician sessions — 3 people

### Task T1 — Find and open the next job

Prompt: "Find the stopped VC-5 ticket with the spindle alarm, open it, and tell me its condition, work state and who reported it."

Success: the participant finds the correct ref, reads both axes accurately and reaches timeline/people/figures without searching through unrelated navigation.

### Task T2 — Start work

Prompt: "Start this ticket as yourself and confirm that your work time has started."

Success: Start is found without facilitator direction, the acting person is correct, work becomes **In progress**, and the machine condition remains independently visible.

### Task T3 — Pause and resume

Prompt: "Pause because you are waiting for a spare, then resume when the spare arrives."

Success: a reason is supplied, **Waiting** is visible while the stopped condition remains intact, resume restores **In progress**, and the participant can find the pause in history.

### Task T4 — Transfer

Prompt: "Hand this job to the next shift with a note, but do not close it. Show me what the next person will see."

Success: a handover note is entered, the ticket remains open, work reads **Waiting for pickup**, and the condition is unchanged. The participant can locate the handover note and people/time detail.

### Task T5 — Failure and connectivity review

Prompt: "The connection failed during one action. Show me what still needs attention and how you would avoid sending it twice."

Success: the participant can distinguish cached detail from a confirmed write, identify pending/draft or unresolved work, and explain why replaying must not create another ticket or apply another transition.

## After the sessions

- Tabulate each participant × task with completion, time, error count/type, assistance, confidence and friction; retain device/language context.
- Review repeated failures before visual polish. Write each proposed flow change back to the relevant journey and record what evidence would verify it.
- Do not claim a pass threshold from an unrun script or a tiny convenience sample. Report missing roles and missing real-phone/language coverage explicitly.
- Usability feedback is an input to D0.3, not Nimish's visual-alignment record and not permission for production implementation.
